import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';
import FormData from 'form-data';
import { URL } from 'url';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import gql from 'graphql-tag';
import {
  parseWxrFromFile,
  parseImagesFromWxr,
  parsePagesFromWxr,
  parseTagsFromWxr,
} from '@robotsnacks/cst-wordpress';
import path from 'path';
import util from 'util';
import _ from 'lodash';

config();

const readFile = util.promisify(fs.readFile);

const RESULT_PATH = path.join(process.cwd(), 'result.json');
const HOST = process.env.HOST;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
// const SITE_ID = process.env.SITE_ID;

if (!HOST) {
  console.error('HOST environment variable not set.');
  process.exit(1);
}

if (!ACCESS_TOKEN) {
  console.error('ACCESS_TOKEN environment variable not set.');
  process.exit(1);
}

// if (!SITE_ID) {
//   console.error('SITE_ID environment variable not set.');
//   process.exit(1);
// }

const createApolloClient = () =>
  new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      fetch,
      headers: {
        authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      uri: `https://${HOST}/graphql`,
    }),
  });

const CREATE_TAG = gql`
  mutation CreateTag($input: CreateTagInput!) {
    createTag(input: $input) {
      tag {
        createdAt
        slug
        id
        name
      }
    }
  }
`;

const CREATE_PAGE = gql`
  mutation CreatePage($input: CreatePageInput!) {
    createPage(input: $input) {
      page {
        id
        path
        title
        description
        content
        images {
          image {
            id
          }
        }
      }
    }
  }
`;

const loadResult = () => {
  if (fs.existsSync(RESULT_PATH)) {
    const { images = {}, tags = {}, pages = {} } = JSON.parse(
      fs.readFileSync(RESULT_PATH, { encoding: 'utf8' }),
    );
    return { images, tags, pages };
  } else {
    return {
      images: {},
      tags: {},
      pages: {},
    };
  }
};

const writeResult = result => {
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), {
    encoding: 'utf8',
  });
};

const submit = (form: FormData, options: FormData.SubmitOptions) =>
  new Promise<any>((resolve, reject) => {
    form.submit(options, (err, res) => {
      if (err) {
        reject(err);
      } else {
        const result: string[] = [];
        res.on('data', chunk => result.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(result.join('')));
          } catch (e) {
            reject(e);
          }
        });
      }
    });
  });

const downloadImage = async (url: string) => {
  const res = await fetch(url);
  const image = await res.buffer();
  const contentType = res.headers.get('content-type');
  return { image, contentType };
};

const retry = async (fn: () => Promise<any>, maxTries = 5, attempt = 1) => {
  try {
    await fn();
  } catch (e) {
    if (attempt > maxTries) {
      throw e;
    }
    const timeout = Math.floor(Math.random() * 5000);
    console.error(e);
    console.error(`Retry #${attempt}: Retrying in ${timeout}ms`);
    await new Promise(resolve => setTimeout(resolve, timeout));
    await retry(fn, maxTries, attempt + 1);
  }
};

const importImage = async (result: any, img: any, url: URL) => {
  const filename = path.basename(url.pathname);
  const { image, contentType } = await downloadImage(img.url);

  const upload = new FormData();

  upload.append('image', image, {
    contentType,
    filename,
  });

  const uploadResult = await submit(upload, {
    host: HOST,
    path: '/api/v0/images',
    protocol: 'https:',
    method: 'POST',
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  result.images[url.pathname] = uploadResult;
};

const importTag = async (
  result: any,
  client: ApolloClient<any>,
  tag: { name: string },
) => {
  try {
    const {
      data: {
        createTag: { tag: createResult },
      },
    } = (await client.mutate({
      mutation: CREATE_TAG,
      variables: {
        input: {
          name: tag.name,
        },
      },
    })) as any;

    result.tags[tag.name] = createResult;
  } catch (e) {
    if (
      _.get(e, 'graphQLErrors[0].extensions.exception.index') ===
      'environmentId_1_slug_1'
    ) {
      // Do nothing.
    } else {
      throw e;
    }
  }
};

const importImages = async (result: any, images: any[]) => {
  let counter = 0;

  console.log('Uploading images...');
  for (const img of images) {
    counter++;
    const url = new URL(img.url);
    if (result.images.hasOwnProperty(url.pathname)) {
      console.log(`Already uploaded ${url.pathname}... skipping.`);
      continue;
    }
    console.log(`${counter}/${images.length}`);
    await retry(() => importImage(result, img, url));
  }
};

const importTags = async (result: any, tags: any[]) => {
  let counter = 0;
  const client = createApolloClient();

  console.log('Importing tags...');
  for (const tag of tags) {
    counter++;
    if (result.tags.hasOwnProperty(tag.name)) {
      console.log(`Already imported tag "${tag.name}"... skipping.`);
      continue;
    }
    console.log(`${counter}/${tags.length}`);
    await importTag(result, client, tag);
    // await retry(() => importImage(result, img, url));
  }
};

const importPage = async (
  result: any,
  client: ApolloClient<any>,
  page: any,
) => {
  // const { pinterestDescription, ...rest } = page;
  const {
    data: {
      createPage: { page: createResult },
    },
  } = (await client.mutate({
    mutation: CREATE_PAGE,
    variables: {
      input: page,
    },
  })) as any;

  result.pages[page.path] = createResult;
};

const importPages = async (result: any, pages: any[]) => {
  let counter = 0;
  const client = createApolloClient();

  console.log('Importing pages...');
  for (const page of pages) {
    counter++;
    if (result.tags.hasOwnProperty(page.path)) {
      console.log(`Already imported page "${page.path}"... skipping.`);
      continue;
    }
    console.log(`${counter}/${pages.length}`);
    try {
      await importPage(result, client, page);
    } catch (e) {
      if (
        _.get(e, 'graphQLErrors[0].extensions.exception.index') ===
        'environment_path_slug'
      ) {
        console.log('Error import page:\n', JSON.stringify(page, null, 2));
      } else {
        console.log(JSON.stringify(e, null, 2));
        throw e;
      }
    }
  }
};

export const runImport = async (wxrPath: string) => {
  const result = loadResult();

  process.on('SIGINT', () => {
    console.log('Received SIGINT. Exiting.');
    writeResult(result);
    process.exit(0);
  });

  const wxr = await readFile(wxrPath, { encoding: 'utf8' });
  // const images = await parseImagesFromWxr(wxr);
  // const tags = await parseTagsFromWxr(wxr);
  const pages = await parsePagesFromWxr(wxr, result.images);

  fs.writeFileSync('./pages.json', JSON.stringify(pages, null, 2), {
    encoding: 'utf8',
  });

  // console.log(pages);

  try {
    await importPages(result, pages);
    // await importImages(result, images);
    // await importTags(result, tags);
  } catch (e) {
    console.log(JSON.stringify(e, null, 2));
    console.error(e);
  } finally {
    writeResult(result);
  }
};
