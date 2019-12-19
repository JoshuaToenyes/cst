import { parseWxr, parsePagesFromWxr, parseWxrFromFile } from '../parse-wxr';
import fs from 'fs';

it('works', async () => {
  const wxr = fs.readFileSync(process.cwd() + '/fixtures/wxr-export.xml', {
    encoding: 'utf8',
  });
  const content = await parsePagesFromWxr(wxr, {});
  for (const page of content) {
    if (page.pinterestDescription) {
      console.log(page.title);
      console.log(page.pinterestDescription);
      console.log('=========================');
    }
  }
});
