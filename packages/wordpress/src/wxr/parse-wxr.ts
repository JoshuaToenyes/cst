import { URL } from 'url';
import cheerio from 'cheerio';
import fs from 'fs';
import mime from 'mime-types';
import util from 'util';
import xml from 'xml2js';
import { concatTemplate } from './concat-template';
import slugify from 'slugify';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const readFile = util.promisify(fs.readFile);

const slugifyPath = (path: string) =>
  '/' + slugify(path.toLowerCase()).replace(/[^a-zA-Z0-9\s\-]/g, '');

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
  name: tag['wp:tag_name'][0],
});

const getFeaturedImage = (post, attachments, images) => {
  const thumbnailId = (() => {
    const meta =
      post['wp:postmeta'] &&
      post['wp:postmeta'].find(
        entry => entry['wp:meta_key'][0] === '_thumbnail_id',
      );
    if (meta) {
      return meta['wp:meta_value'][0];
    } else {
      return null;
    }
  })();

  const featuredImageUrl = (() => {
    if (thumbnailId) {
      const attachment = attachments.find(
        attachment => attachment['wp:post_id'][0] === thumbnailId,
      );
      if (attachment) {
        return attachment.guid[0]._;
      } else {
        return null;
      }
    }
  })();

  const featuredImage = featuredImageUrl
    ? (() => {
        const url = new URL(featuredImageUrl);
        return images[url.pathname] || null;
      })()
    : null;

  return featuredImage;
};

const transformEncodedHtmlContent = (
  title: string,
  url: string,
  html: string,
  images: any[],
  post: any,
  attachments: any,
) => {
  const featuredImage = getFeaturedImage(post, attachments, images);

  const $ = cheerio.load(html[0]);

  // const base = new URL(url);

  const root = genKey();

  const ops = [
    {
      attributes: {},
      insert: '.-0',
      key: root,
      type: 'STACK',
    },
  ];

  if (featuredImage) {
    ops.push({
      attributes: {
        filename: featuredImage.filename,
        id: featuredImage.id,
      },
      insert: `${root}.${ops.length}`,
      key: genKey(),
      type: 'IMAGE',
    });
  }

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

  $('h1, h2, h3, h4, h5, h6, p, li, img').each((n, el) => {
    switch (el.tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
      case 'p':
        htmlCollection.push(`<${el.tagName}>${$(el).html()}</${el.tagName}>`);
        break;

      case 'li':
        htmlCollection.push(`<p>${$(el).html()}</p>`);
        break;

      case 'img':
        flushHtml();

        if (!el.attribs.src) {
          break;
        }

        let src = el.attribs.src.startsWith('//')
          ? 'https://' + el.attribs.src
          : el.attribs.src;

        const imageUrl = new URL(
          src
            .replace(
              /https:\/\/[^.]+.wp.com\/culturetrekking.com\//,
              'https://culturetrekking.com/',
            )
            .replace(/-\d+x\d+\./, '.'),
        );

        const image = images[imageUrl.pathname];

        if (!image) {
          console.log('missing image', {
            imageUrl: imageUrl.href,
            url,
          });
          break;
        }

        // const fullUrl = createFullUrl(el.attribs.src, base);
        // TODO:!!!
        // const image = { filename: 'test', id: '###test' }; // images[fullUrl];
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

  return { ops: ops.concat(concatTemplate(root, ops.length)) };
};

const transformPage = (post: any, attachments: any, images: any) => {
  const status = post['wp:status'][0];
  const title = post.title[0];

  const featuredImage = getFeaturedImage(post, attachments, images);

  // tp_pinterest_default_text
  const pinterestDescription = (() => {
    const meta =
      post['wp:postmeta'] &&
      post['wp:postmeta'].find(
        meta => meta['wp:meta_key'][0] === 'tp_pinterest_default_text',
      );
    if (meta) {
      return meta['wp:meta_value'][0];
    } else {
      return '';
    }
  })();

  // const url = post.
  return {
    title,
    description: post.description[0],
    pinterestDescription,
    images: featuredImage
      ? [
          {
            imageId: featuredImage.id,
            type: 'generic',
          },
        ]
      : undefined,
    path:
      status === 'draft' ? slugifyPath(title) : new URL(post.link[0]).pathname,
    publishAt: status === 'draft' ? null : new Date(post.pubDate[0]),
    content: transformEncodedHtmlContent(
      title,
      '',
      post['content:encoded'],
      images,
      post,
      attachments,
    ),
    tags: post.category ? post.category.map(category => category._) : [],
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

export const parseImagesFromWxr = async (wxr: string): Promise<any[]> => {
  const content = await xml.parseStringPromise(wxr);

  const channel = content.rss.channel[0];
  const items = channel.item;

  const attachments = items.filter(filterByPostType('attachment'));
  const images = attachments.filter(pickImages());

  return images.map(transformImage());
};

export const parseTagsFromWxr = async (wxr: string): Promise<any[]> => {
  const content = await xml.parseStringPromise(wxr);
  const channel = content.rss.channel[0];
  const tags = channel['wp:tag'];
  return tags.map(transformTag());
};

export const parsePagesFromWxr = async (
  wxr: string,
  images: any,
): Promise<any[]> => {
  const content = await xml.parseStringPromise(wxr);

  const channel = content.rss.channel[0];
  const items = channel.item;
  const attachments = items.filter(filterByPostType('attachment'));
  const pages = items.filter(filterByPostType('page'));
  const posts = items.filter(filterByPostType('post'));

  return [...pages, ...posts].map(page =>
    transformPage(page, attachments, images),
  );
};

export const parseWxrFromFile = async (path: string): Promise<object> => {
  const content = await readFile(path, { encoding: 'utf8' });
  return parseWxr(content);
};
