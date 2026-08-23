# Encrypted RDS for username credentials

This stack provisions a **new** PostgreSQL 16 database for signup/login hashes and saved chart prefs. It is not the Neon `wallet.events` database (`DATABASE_URL`).

AWS protocols used:

- RDS storage encryption with a customer-managed KMS key
- TLS required (`rds.force_ssl=1`); app connections use `sslmode=verify-full`
- Master password in Secrets Manager (also KMS-encrypted)
- IAM database authentication enabled for a later cutover from static passwords
- Instance is **not** publicly accessible — place the auth API in the same VPC

## Deploy

```bash
aws cloudformation deploy \
  --stack-name coinbasebot-auth-rds \
  --template-file infra/auth-rds.yaml \
  --parameter-overrides \
    VpcId=vpc-xxxxxxxx \
    SubnetIds=subnet-aaaa,subnet-bbbb \
    AllowedCidr=10.0.0.0/8 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

Read the endpoint and secret (never commit them):

```bash
aws cloudformation describe-stacks --stack-name coinbasebot-auth-rds \
  --query 'Stacks[0].Outputs'
aws secretsmanager get-secret-value --secret-id coinbasebot/auth/rds-master
```

Build `AUTH_DATABASE_URL` as:

```text
postgresql://cbadmin:PASSWORD@ENDPOINT:5432/coinbasebot_auth?sslmode=verify-full
```

Then:

```bash
AUTH_DATABASE_URL='...' AUTH_DATABASE_URL_OWNER='...' npm run auth:migrate
```

`auth:migrate` applies [sql/auth.sql](../sql/auth.sql), creates the `auth_app` role when the owner URL is set, and applies [sql/auth-security.sql](../sql/auth-security.sql). Runtime `AUTH_DATABASE_URL` should use `auth_app`, not the master user.

Download the [Amazon RDS CA bundle](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem) if your environment does not already trust the RDS certificate chain. Set `AUTH_DATABASE_SSL_CA` to that file path.

Local/cloud development without AWS: omit `AUTH_DATABASE_URL`. The auth API uses an on-disk PGlite store under `.data/auth` with the same schema.
