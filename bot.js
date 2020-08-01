/**
 * CuteYuriBot
 * A reddit mirroring bot
 * @ZoeyLovesMiki
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const Jimp = require('jimp');

/**
 * Load our config file
 */
const configs = require('./config.json');

/**
 * Prepare Twitter
 */
const twit = require('twit');
const Twitter = new twit(configs.twitter);

/**
 * Prepare Reddit
 */
const snoowrap = require('snoowrap');
const Reddit = new snoowrap(configs.reddit);

/**
 * Prepare our database
 */
const knex = require('knex');
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './queue.db'
  }
});

// Create our table if it doesn't exist
db.schema.hasTable('posts').then(async exists => {
  if (exists) return;

  await db.schema.createTable('posts', table => {
    table.increments('id');
    table.string('title');
    table.string('post_id');
    table.string('img_url');
    table.string('post_url');
    table.string('source_url');
    table.boolean('posted').defaultTo(false);
  });
});

/**
 * Get the source via SauceNAO
 */
async function getSource(image_url) {
  try {
    const res = await fetch(`https://saucenao.com/search.php?db=999&output_type=2&numres=1&api_key=${configs.saucenao_key}&url=${image_url}`);

    const json = await res.json();

    return json.results[0].data.ext_urls[0];
  } catch(e) {
    return "";
  }
}

/**
 * Post the next item in the queue
 */
async function postPosts() {
  console.log("Checking for posts.");
  // Get the posts that aren't posted
  const posts = await db('posts').where('posted', false);

  if (posts.length == 0) return;

  // Get the last post in the posts list
  const post = posts[posts.length - 1];

  // Get the source
  const source_url = await getSource(post.img_url);

  await db('posts').where('id', post.id).update({source_url: source_url});

  // Get the image as a buffer
  let image = await fetch(post.img_url);
  image = await image.buffer();

  // Try to compress the image if required
  const size = Buffer.from(image).byteLength;

  if (size > 5000000) {
    const jimage = await Jimp.read(image);

    jimage.scale(0.75);

    image = await jimage.getBase64Async(Jimp.AUTO);
  }

  // Post the image to Twitter
  Twitter.post('media/upload', { media_data: image.toString('base64') }, (err, data, response) => {
    if (err) {
      console.log(`Couldn't post #${post.id}. Trying again later.`);
      return;
    }

    const media = data.media_id_string;

    const tweet = {
      status: post.title,
      media_ids: [media]
    };

    // Post the image to Twitter
    Twitter.post('statuses/update', tweet, async (err, data, response) => {
      if (err) {
        console.log(`Couldn't post #${post.id}. Trying again later.`);
        return;
      }

      // Get the tweet ID of the image tweet
      const imageTweetID = data.id_str;

      let status = `@${data.user.screen_name} Original post: https://reddit.com${post.post_url}`;

      if (source_url != "") {
        status += `\nSource: ${source_url}`;
      }

      // Create a tweet with the source
      let sourceTweet = {
          status: status,
          in_reply_to_status_id: imageTweetID
      };

      Twitter.post('statuses/update', sourceTweet, async (err, data, response) => {
        if (err) {
          console.log(`Couldn't post #${post.id}. Trying again later.`);
          return;
        }

        await db("posts").where({ id: post.id }).update({ posted: true });
      });
    });
  });
}

/**
 * Fetch posts from a subreddit 
 */ 
async function fetchPosts(subreddit) {
  // Get the new posts
  const posts = await Reddit.getSubreddit(subreddit).getNew();

  for (const post of posts) {
    // Check if we have more than 50 upvotes
    if (post.ups <= 50) continue;

    // Check if the post is already in our database
    const postInDb = await db('posts').where('post_id', post.id);
    if (postInDb.length > 0) continue;

    // Check if the post url is already in our database
    const urlInDb = await db('posts').where('img_url', post.url);
    if (urlInDb.length > 0) continue;

    // Skip videos
    if (post.is_video) continue;

    // Check if it's a valid format
    const extname = path.extname(post.url).replace(".", "");

    // Skip unsupported formats
    if (!['gif', 'jpg', 'jpeg', 'png'].includes(extname)) continue;


    console.log("Adding post into db");
    // Add the post to the db
    await db('posts').insert({
      title: post.title,
      post_id: post.id,
      img_url: post.url,
      post_url: post.permalink,
      source_url: "",
    });
  }
}

/**
 * Load our list of subreddits and create a timer to fetch them every minute
 */
configs.subs.forEach(subreddit => {
  fetchPosts(subreddit);

  setInterval(() => {
    fetchPosts(subreddit);
  }, 60*1000);
});

/**
 * Loop that will post posts from the queue every 15 minutes
 */
setInteval(() => {
  postPosts();
}, 15*60*1000);
