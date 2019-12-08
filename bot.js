/**
 * CuteYuriBot
 * By: @ZoeyLovesMiki
 */

// Imports
let twit = require('twit'),
    snoowrap = require('snoowrap'),
    axios = require('axios'),
    chalk = require('chalk'),
    fs = require('fs'),
    path = require('path');

if (!fs.existsSync("config.json"))
    throw "No config file found!";

// Import our config file
let configs = require('./config.json');

// Create a Twitter instance
let Twitter = new twit(configs.twitter);

// Create a Reddit instance
let Reddit = new snoowrap(configs.reddit);

// Our file that keeps a copy of our posts
const posts_file = "posts.json";

// Queue of posts
let queue = [];

// Check if post wasn't posted already
function checkIfPosted(id) {
    // Create an empty file if it doesn't exist.
    if (!fs.existsSync(posts_file)) {
        fs.writeFileSync(posts_file, JSON.stringify([]), {encoding: "utf-8"});
    }

    // Load our posts file
    let posts = JSON.parse(fs.readFileSync(posts_file, {encoding: "utf-8"}));

    return posts.includes(id);
}

// Add to the posted videos list
function postedVideo(id) {
    let posts = JSON.parse(fs.readFileSync(posts_file, {encoding: "utf-8"}));

    posts.push(id);

    if (posts.length > 30) {
        posts.pop();
    }

    fs.writeFileSync(posts_file, JSON.stringify(posts), {encoding: "utf-8"});
}

// Add a post to the Twitter queue
function addToQueue(post) {
    // Mark the post as posted
    postedVideo(post.id);

    // Don't post videos
    if (post.is_video) {
        return;
    }

    // Make sure the file format is correct
    if (![".gif", ".png", ".jpg", ".jpeg"].includes(path.extname(post.url))) {
        return;
    }

    console.log(chalk.green(`"${post.title}" added to the queue!`));

    queue.push({
        "title": post.title,
        "link": `https://reddit.com${post.permalink}`,
        "url": post.url,
        "author": post.author.name
    });
}

// Retrieve an image as base64
async function urlToBase64(url) {
    let response = await axios.get(url, {responseType: 'arraybuffer'});

    let base64 = Buffer.from(response.data, 'binary').toString('base64');

    return base64;
}

// Create tweets from our queue
async function checkForQueue() {
    console.log(chalk.blue(`Checking for posts in the queue.`));

    // Make sure the queue isn't empty
    if (queue.length <= 0) {
        console.log(chalk.red(`Nothing to post.`));
        return;
    }

    // Get our post
    let post = queue.pop();

    console.log(chalk.yellow(`Posting "${post.title}"...`));

    // Encode the file in base64
    let b64 = await urlToBase64(post.url);

    // Upload the file to Twitter
    Twitter.post('media/upload', {media_data: b64 }, (err, data, response) => {
        // Get our media id
        let media = data.media_id_string;
        
        // Create a tweet
        let tweet = {
            status: post.title,
            media_ids: [media]
        };

        // Post the image/tweet
        Twitter.post('statuses/update', tweet, (err, data, response) => {
            // Get our tweet id
            let tweetId = data.id_str;

            // Create a tweet with the source
            let sourceTweet = {
                status: `@${data.user.screen_name} Posted by ${post.author}.\nOriginal post: ${post.link}`,
                in_reply_to_status_id: tweetId
            };

            // Post the reply
            Twitter.post('statuses/update', sourceTweet, (err, data, response) => {
                console.log(chalk.green(`"${post.title}" posted!`));
            });
        });
    });
}

// Main function
async function checkForPosts(name) {
    console.log(chalk.blue("Checking for posts."));

    let listings = await Reddit.getSubreddit(name).getNew();

    // Go through the new posts
    for (let post of listings) {
        // Make sure it wasn't posted already
        if (!checkIfPosted(post.id)) {
            console.log(chalk.yellow(`Adding "${post.title}" to the queue.`));
            addToQueue(post);
        }
    }
}

// Load the subreddits from the config file
for (let sub of configs.subs) {
    // Create an interval loop to check for posts from that sub
    setInterval(() => {
        checkForPosts(sub);
    }, 1000*60);

    // Initial check
    checkForPosts(sub);
}

// Post loop
setInterval(() => {
    checkForQueue();
}, 1000*60*15);
