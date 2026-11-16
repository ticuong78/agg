import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 254 }) email: string;
  @Column({ type: 'varchar', length: 80 }) name: string;
  @Column({ type: 'varchar', length: 10 }) role: 'USER' | 'ADMIN';
  @Index({ unique: true }) @Column({ name: 'referral_code', type: 'varchar', length: 16 }) referralCode: string;
  @Column({ name: 'referred_by_user_id', type: 'uuid', nullable: true }) referredByUserId: string | null;
  @Column({ name: 'marketing_consent', type: 'boolean', default: false }) marketingConsent: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'last_sign_in_at', type: 'timestamptz', nullable: true }) lastSignInAt: Date | null;
}

@Entity('sign_in_codes')
export class SignInCodeOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 254 }) email: string;
  @Column({ name: 'code_hash', type: 'varchar', length: 128 }) codeHash: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'int', default: 0 }) attempts: number;
}
