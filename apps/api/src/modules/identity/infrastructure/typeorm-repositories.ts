import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { SignInCodeRepository, UserRepository } from '../domain/repositories.js';
import { SignInCode } from '../domain/sign-in-code.js';
import { User } from '../domain/user.js';
import { SignInCodeOrmEntity, UserOrmEntity } from './orm-entities.js';

const toUser = (row: UserOrmEntity) => User.restore({ ...row });

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? toUser(row) : null;
  }
  async findByEmail(email: string) {
    const row = await this.repo.findOneBy({ email });
    return row ? toUser(row) : null;
  }
  async findByReferralCode(referralCode: string) {
    const row = await this.repo.findOneBy({ referralCode });
    return row ? toUser(row) : null;
  }
  async findManyByIds(ids: string[]) {
    return (await this.repo.findBy({ id: In(ids) })).map(toUser);
  }
  async save(user: User) {
    await this.repo.save(this.repo.create(user.snapshot()));
  }
  async delete(id: string) {
    await this.repo.delete({ id });
  }
}

@Injectable()
export class TypeOrmSignInCodeRepository extends SignInCodeRepository {
  constructor(@InjectRepository(SignInCodeOrmEntity) private readonly repo: Repository<SignInCodeOrmEntity>) {
    super();
  }

  async find(email: string) {
    const row = await this.repo.findOneBy({ email });
    return row ? SignInCode.restore(row) : null;
  }
  async save(code: SignInCode) {
    await this.repo.save(this.repo.create(code.snapshot()));
  }
  async delete(email: string) {
    await this.repo.delete({ email });
  }
}
