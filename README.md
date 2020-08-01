### CuteYuriBot

NodeJS bot that reposts content from specified subreddits to Twitter.  

To run this bot, you'll need to create your own `config.json` file at the root of the project like this:  
```JS
{
  "subs": ["sub_name_here"],
  "saucenao_key": "api_key_here",
  "reddit": {
    "userAgent": "My bot/1.0 (By: author)",
    "clientId": "app_id",
    "clientSecret": "app_secret",
    "refreshToken": "refresh_token"
  },
  "twitter": {
    "consumer_key": "app_key",
    "consumer_secret": "app_secret",
    "access_token": "user_token",
    "access_token_secret": "user_token_secret"
  }
}
```
Make sure to install the modules via `npm install` and then run it using `node bot.js`.  