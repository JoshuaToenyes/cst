import minimist from 'minimist';
import { help } from './help';

const cli = () => {
  const argv = minimist(process.argv.slice(2));

  switch (argv._[0]) {
    case 'help':
    default:
      console.log(help);
  }
};

cli();
