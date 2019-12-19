import minimist from 'minimist';
import { help } from './help';
import { runImport } from './import';

const cli = () => {
  const argv = minimist(process.argv.slice(2));

  switch (argv._[0]) {
    case 'import':
      runImport(argv._[1]);
      break;

    case 'help':
    default:
      console.log(help);
  }
};

cli();
