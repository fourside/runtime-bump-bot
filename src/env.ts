export const Env = {
  personalAccessToken:
    process.env.PERSONAL_ACCESS_TOKEN || unreachable("PERSONAL_ACCESS_TOKEN"),
} as const;

function unreachable(name: string): never {
  throw new Error(`${name} is not set in environment variable`);
}
