import chalk from 'chalk';

export const help = chalk`
{bold NAME}
    cst - Transform data to and from Cardsetter compatible archive formats.

{bold SYNOPSIS}
    cst {bold.underline GROUP} | {bold.underline COMMAND} [--help, -h]

{bold DESCRIPTION}
    The {bold csctl} CLI manages Cardsetter deployments, resources, local
    development clusters, and interacts with the production admin API.

{bold GROUPS}
    {bold.underline GROUP} is one of the following:

    {bold auth}
        Authenticate with the Cardsetter.

    {bold config}
        Manage Cardsetter admin command line configuration.
        
    {bold domains}
        Manage Cardsetter domain records.

    {bold organizations}
        Manage CardsetterA organizations.
  
    {bold pods}
        Manage Cardsetter resource pods.

    {bold users}
        Manage Cardsetter users.
`.trimLeft();

export const GLOBAL_FLAGS = chalk`
{bold GLOBAL FLAGS}
    --no-input, -N
        Do not prompt for input from the command line.
`.trim();
