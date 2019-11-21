import { parseWxr, parseWxrFromFile } from '../parse-wxr';

it('works', async () => {
  const content = await parseWxrFromFile(
    process.cwd() + '/fixtures/wxr-export.xml',
  );
});
