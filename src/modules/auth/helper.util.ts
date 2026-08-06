/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
import * as bcrypt from 'bcrypt';
import configuration from '../../config/app.config';

export async function hashPassword(password: string): Promise<string> {
  // configuration() returns a plain object, no 'await' needed
  const salt = configuration().security.salt;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return bcrypt.compare(password, hash);
}

//jwt generator and validator function below
