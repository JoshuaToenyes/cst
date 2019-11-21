import { URL } from 'url';
import cheerio from 'cheerio';
import fs from 'fs';
import mime from 'mime-types';
import util from 'util';
import xml from 'xml2js';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const readFile = util.promisify(fs.readFile);

/**
 * Generates a random value.
 * @param a Replaced string arg.
 */
const rep = a => (a ^ ((Math.random() * 16) >> (a / 4))).toString(16);

/**
 * Generates a UUID.
 */
const uuid = () =>
  (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, rep);

/**
 * Generates a block ID.
 */
const genKey = () => {
  return `blk_${uuid().replace(/-/g, '')}`;
};

const createFullUrl = (url, base) => {
  if (/^https?:\/\//i.test(url)) {
    const u = new URL(url);
    return u.toString();
  } else {
    const u = new URL(url, base);
    return u.toString();
  }
};

const transformTag = () => (tag: any) => ({
  name: tag['wp:tag_name'],
});

const transformEncodedHtmlContent = (
  title: string,
  url: string,
  html: string,
  images: any[],
) => {
  const $ = cheerio.load(html);

  const base = new URL(url);

  const root = genKey();

  const ops = [
    {
      attributes: {},
      insert: '.-0',
      key: root,
      type: 'STACK',
    },
  ];

  let htmlCollection = [`<h1>${title}</h1>`];

  const flushHtml = () => {
    if (htmlCollection.length > 0) {
      ops.push({
        attributes: {
          html: htmlCollection.join('\n'),
        },
        insert: `${root}.${ops.length}`,
        key: genKey(),
        type: 'RICHTEXT',
      });
    }
    htmlCollection = [];
  };

  $('p, img').each((n, el) => {
    switch (el.tagName) {
      case 'p':
        htmlCollection.push(`<p>${$(el).html()}</p>`);
        break;

      case 'img':
        flushHtml();
        const fullUrl = createFullUrl(el.attribs.src, base);
        // TODO:!!!
        const image = { filename: 'test', id: '###test' }; // images[fullUrl];
        ops.push({
          attributes: {
            filename: image.filename,
            id: image.id,
            _format: 'content_width',
          },
          insert: `${root}.${ops.length}`,
          key: genKey(),
          type: 'IMAGE',
        });
        break;

      default:
        throw new Error(`Unexpected tag name: ${el.tagName}`);
    }
  });

  flushHtml();

  return { ops };
};

const transformPage = (page: any) => {};

const transformPost = (post: any, images: any) => {
  const status = post['wp:status'][0];
  const title = post.title[0];

  // const url = post.
  return {
    title,
    description: post.description[0],
    content: transformEncodedHtmlContent(
      title,
      '',
      post['content:encoded'],
      images,
    ),
  };
};

const transformImage = () => (image: any) => ({
  description: image.description[0],
  title: image.title[0],
  url: image['wp:attachment_url'][0],
});

const filterByPostType = (postType: string) => (item: any) =>
  item['wp:post_type'][0] === postType;

const pickImages = () => (attachment: any): false | string => {
  const mimeType = mime.lookup(attachment['wp:attachment_url'][0]);
  return mimeType
    ? (IMAGE_MIME_TYPES.includes(mimeType) as string | false)
    : false;
};

export const parseWxr = async (wxr: string): Promise<object> => {
  const content = await xml.parseStringPromise(wxr);

  const channel = content.rss.channel[0];
  const items = channel.item;

  const tags = channel['wp:tag'];
  const attachments = items.filter(filterByPostType('attachment'));

  const pages = items.filter(filterByPostType('page'));
  const posts = items.filter(filterByPostType('post'));

  const images = attachments.filter(pickImages());

  return {
    attachments,
    content,
    images: images.map(transformImage()),
    pages,
    posts,
    tags: tags.map(transformTag()),
  };
};

export const parseWxrFromFile = async (path: string): Promise<object> => {
  const content = await readFile(path, { encoding: 'utf8' });
  return parseWxr(content);
};
