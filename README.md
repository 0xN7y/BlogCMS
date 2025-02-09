# BlogCMS
A simple blog CMS built with Node.js and Express 

# BlogCMS

A simple blog CMS built with Node.js and Express.

## Features
- User authentication
- Blog posting
- Search functionality
  

## Setup
1. Clone the repo: `git clone https://github.com/0xN7y/BlogCMS.git`
2. Install dependencies: `npm install`
3. Set up json confige file `setupconfig.json` With Mysql credentials information
```json
{
	"host" : "localhost",
	"user": "root", 
  	"password": "mysqlpassword"
}
```
4. Run the createdb.js: `node createdb.js`
5. Run the app: `npm start` or `node app.js`
