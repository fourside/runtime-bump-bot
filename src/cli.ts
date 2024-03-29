import { Command, type OptionValues } from "commander";

interface Options extends OptionValues {
  owner: string;
  repo: string;
  base: string;
  working: string;
}

export function cli(): Options {
  const program = new Command();
  program
    .requiredOption("-o, --owner <owner>", "owner")
    .requiredOption("-r, --repo <repo>", "repository")
    .requiredOption("-b, --base <branch>", "base branch", "main")
    .requiredOption("-w, --working <branch>", "working branch", "bump");
  program.parse();
  return program.opts<Options>();
}
