import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * GD-1 baseline: the schema of the 14 tables as the entities define them at commit 1f6726a, generated with
 * `migration:generate` against an empty database. Edited by hand only to add IF NOT EXISTS, so a database that
 * DB_SYNC already built is recorded as migrated instead of failing (the drift guard then confirms it matches).
 * There are no foreign keys between tables. It cannot be reverted (see down). Later migrations are generated and kept
 * as generated.
 */
export class Baseline1794911961474 implements MigrationInterface {
    name = 'Baseline1794911961474'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "wallets" ("id" uuid NOT NULL, "owner_kind" character varying(10) NOT NULL, "owner_id" uuid NOT NULL, "buckets" jsonb NOT NULL, CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b6703595000737e1f985749ad5" ON "wallets"  ("owner_kind", "owner_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ledger_entries" ("id" uuid NOT NULL, "wallet_id" uuid NOT NULL, "user_id" uuid, "amount" integer NOT NULL, "reason" character varying(200) NOT NULL, "reference" character varying(200), "at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_87e16bf34eef5c729be2679b48" ON "ledger_entries"  ("wallet_id", "at") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "subscriptions" ("id" uuid NOT NULL, "owner_kind" character varying(10) NOT NULL, "owner_id" uuid NOT NULL, "tier" character varying(12) NOT NULL, "period" character varying(6) NOT NULL, "extra_seats" integer NOT NULL DEFAULT '0', "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "next_grant_at" TIMESTAMP WITH TIME ZONE NOT NULL, "grants_made" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c771ac417436346a980e69654d" ON "subscriptions"  ("next_grant_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_9a8d2bbc25d08724e1940dec4e" ON "subscriptions"  ("owner_kind", "owner_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "orders" ("id" uuid NOT NULL, "code" character varying(16) NOT NULL, "buyer_user_id" uuid NOT NULL, "product" jsonb NOT NULL, "description" character varying(200) NOT NULL, "amount" integer NOT NULL, "provider" character varying(10) NOT NULL, "status" character varying(10) NOT NULL, "provider_ref" character varying(200), "workspace_name" character varying(120), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_3e413c10c595c04c6c70e58a4d" ON "orders"  ("code") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fabd89e604fa871fbd13fc0d92" ON "orders"  ("buyer_user_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders"  ("status") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "workspaces" ("id" uuid NOT NULL, "name" character varying(120) NOT NULL, "owner_user_id" uuid NOT NULL, "header" character varying(200) NOT NULL DEFAULT '', "members" jsonb NOT NULL, "member_emails" text array NOT NULL, CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_552b8a0813f929c0d369c5f7ff" ON "workspaces"  ("owner_user_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b859ba293c11e0ffbe8070835f" ON "workspaces"  ("member_emails") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "daily_usage" ("key" character varying(80) NOT NULL, "day" character varying(10) NOT NULL, "count" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_b21f54eae62f456dd5cfa091fb9" PRIMARY KEY ("key", "day"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "visitors" ("id" uuid NOT NULL, "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attribution" jsonb NOT NULL, "user_agent" character varying(300), "language" character varying(20), "ip_hash" character varying(64) NOT NULL, "country" character varying(2), "analytics_consent" boolean NOT NULL DEFAULT false, "marketing_consent" boolean NOT NULL DEFAULT false, "consent_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid, "visits" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_d0fd6e34a516c2bb3bbec71abde" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ec75b64d75b743afeab8c583a2" ON "visitors"  ("user_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "leads" ("id" uuid NOT NULL, "email" character varying(254) NOT NULL, "name" character varying(120), "phone" character varying(30), "organization" character varying(200), "sources" jsonb NOT NULL, "marketing_consent" boolean NOT NULL DEFAULT false, "consent_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid, "visitor_ids" jsonb NOT NULL, "attributes" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_b3eea7add0e16594dba102716c" ON "leads"  ("email") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3dc86c1276d56ff0d56e4c462c" ON "leads"  ("updated_at") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "reward_claims" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "activity" character varying(20) NOT NULL, "status" character varying(10) NOT NULL, "credits" integer NOT NULL DEFAULT '0', "title" character varying(200) NOT NULL, "payload" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE, "note" character varying(500), CONSTRAINT "PK_f30d647df5942da2bf0371e2e62" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cf374e6b9033cb1a38f552529d" ON "reward_claims"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_bfa36d264b1e61ebe02c5bee53" ON "reward_claims"  ("status") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "referrals" ("id" uuid NOT NULL, "referrer_user_id" uuid NOT NULL, "referee_user_id" uuid NOT NULL, "status" character varying(10) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "qualified_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ea9980e34f738b6252817326c08" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f23553d02832ad08a505cf382b" ON "referrals"  ("referrer_user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_26662895e0e145945a636378e1" ON "referrals"  ("referee_user_id") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "analytics_events" ("id" BIGSERIAL NOT NULL, "visitor_id" uuid, "user_id" uuid, "name" character varying(60) NOT NULL, "path" character varying(300), "props" jsonb NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_5d643d67a09b55653e98616f421" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b9b82d675e85ae5766d6b81561" ON "analytics_events"  ("name", "at") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL, "email" character varying(254) NOT NULL, "name" character varying(80) NOT NULL, "role" character varying(10) NOT NULL, "referral_code" character varying(16) NOT NULL, "referred_by_user_id" uuid, "marketing_consent" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_sign_in_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ba10055f9ef9690e77cf6445cb" ON "users"  ("referral_code") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "sign_in_codes" ("email" character varying(254) NOT NULL, "code_hash" character varying(128) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_e937476297b5db9c53daed7d6ab" PRIMARY KEY ("email"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "conversions" ("id" uuid NOT NULL, "owner_user_id" uuid, "guest_key_hash" character varying(64), "visitor_id" uuid, "status" character varying(12) NOT NULL, "engine" character varying(8), "sources" jsonb NOT NULL, "problems" jsonb NOT NULL, "settings" jsonb NOT NULL, "failure" text, "credits_charged" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4af8c6388f42a1849ee9b22fa16" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b5f53cae8a26ac1c89ace789fa" ON "conversions"  ("owner_user_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7c183c43669b3b483b9f475be7" ON "conversions"  ("expires_at") `);
    }

    public async down(): Promise<void> {
        // Reverting the baseline would drop every table and its data, so one `migration:revert` too many on a real
        // database must fail instead (as in OnlineJudge, R10). To start over locally, drop the database.
        throw new Error('The baseline migration cannot be reverted: it would drop every table. Restore a backup or recreate the database instead.');
    }

}
