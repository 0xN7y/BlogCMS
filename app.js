// Developed by Netneal Amsalu(N7y)
const bodyParser = require('body-parser');
const express = require('express');
const ejs = require("ejs");
const path = require("path");
const mysql = require('mysql2');
const fs = require('fs');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html'); 
const fileType = require('file-type');
const sharp = require('sharp');// metadata sannitation

const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const helmet = require('helmet');




const app = express();



 app.use( 
      helmet ({
         contentSecurityPolicy: { 
              directives: { 
	              defaultSrc: ["'self'"], scriptSrc: ["'self'"],
	              styleSrc: ["'self'", "'unsafe-inline'"],  
	              imgSrc: ["'self'", "data:"], 
	              objectSrc: ["'none'"], 
	              frameSrc: ["'none'"],  
	              baseUri: ["'self'"]
 			} 
 		} 
	}) 
);



const loadconfigg = (conf) => {
    try {
        const data = fs.readFileSync(conf, 'utf8'); 
        return JSON.parse(data); 
    } catch (err) {
        console.error("setup file not found:", err);
        return null;
    }
};

const conf = loadconfigg('./setupconfig.json');


app.set("view engine", "ejs");
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));


app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));


const connection = mysql.createConnection({
  host: conf["host"],     
  user: conf["user"], 
  password: conf["password"], 
  database: 'blogcms',
  multipleStatements: true
});

const sessionStore = new MySQLStore({}, connection.promise());


function genkey() {
  return crypto.randomBytes(64).toString('hex');
}

if (! process.env.BLOGCMS_SESSION_KEY) {
	process.env.BLOGCMS_SESSION_KEY = genkey();
}

app.use(session({
    secret: process.env.BLOGCMS_SESSION_KEY,   
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, 
        secure: false,  // true, if htttps
        httpOnly: true
    }
}));




function userexist(u,callback) {
	
	sql = "SELECT username FROM Users where username=? LIMIT 1";
	connection.query(sql, [u], function(err, res) {
		if (err) throw err;
		
		callback(res.length > 0)
		
	});	
}

// userexist("bob", console.log);
// userexist("bob", function(stat) {
// 	console.log(stat);
// });

function md5(c) {
	return crypto.createHash('md5').update(c).digest('hex');
}

function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function auth(u,p, callback) {
	userexist(u, function(stat) {
		if (stat) {
			// console.log("user found : " , u);
			const hashedp = sha256(p);
			sql = "SELECT password FROM Users WHERE username=? LIMIT 1";
			connection.query(sql, [u], function(err, res) {
				if (err) throw err;
				realpass = res[0]?.password
				
				callback(realpass === hashedp);
			}) 
		}else {
				callback(false)
			}
	})

}
// auth("bob","bob", console.log);
// auth("bob", "pass", function(stat) {
// 	console.log(stat)
// })

// check email standard, 
function registerUser(u,p,email, callback) {
	userexist(u, function(stat) {
		if (stat) {
			// console.log("USer exists;")
			callback(false);
		}else {
			sql = "INSERT INTO Users (username,email,password) VALUES (?,?,?)"
			hashp = sha256(p)
			connection.query(sql, [u,email,hashp], function(err, res ) {
				if (err) throw err;
				callback(true);
			})
		}
	})
}
// registerUser("alice", "alice", "alice@email", function(stat) {
// 	console.log(stat)
// })



	

function insertblog(uid, title, content, imageuri, tags) {
	// uid.int ,title,content, savedImages[] ,tag[]
	// insertblog(1,'oktitle', 'html content ', ['url1', 'url2'], ['tag1', 'tag2']);
	

	// START TRANSACTION;
	// INSERT INTO Posts (user_id, title, content, featured_image, status)
	// VALUES (1, 'My First Post', 'This is the content of my first post.', 'images/featured.jpg', 'published');
	// SET @post_id = LAST_INSERT_ID();
	// COMMIT;
	// SELECT @post_id AS post_id;
	
	// START TRANSACTION;
	// INSERT INTO Tags (tag_name) VALUES ('technology'), ('programming')
	// ON DUPLICATE KEY UPDATE tag_name = tag_name;
	// SET @tag_id = LAST_INSERT_ID();
	// COMMIT;
	//SELECT @tag_id AS tag_id

	// INSERT INTO Post_Tags (post_id, tag_id) VALUES (1, 1), (1, 2);
	// console.log(processedContent);


	const sql = `
	  START TRANSACTION;
	  INSERT INTO Posts (user_id, title, content, status) 
	  VALUES (?, ?, ?, 'published');
	  COMMIT;
	  SELECT LAST_INSERT_ID() AS post_id;
	`;

	connection.query(sql, [uid, title, content], function (err, res) {
		if (err) throw err;
		let poid = res[res.length - 1][0].post_id 
		// console.log("Using postId:", poid);
		

		const tagValues = tags.map(tag => [tag]);



		const addTag = `
			INSERT INTO Tags (tag_name) VALUES ?
			ON DUPLICATE KEY UPDATE tag_name = tag_name;
		`;

		connection.query(addTag, [tagValues], function (err) {
			if (err) throw err;

	
			const getTagIds = `SELECT tag_id FROM Tags WHERE tag_name IN (?)`;
			connection.query(getTagIds, [tags], function (err, resp) {
				if (err) throw err;
				const tagIds = resp.map(row => row.tag_id);
				// console.log("Tag IDs:", tagIds);

	
				const postTagsValues = tagIds.map(tagId => [poid, tagId]);
				const addPostTag = `INSERT INTO Post_Tags (post_id, tag_id) VALUES ?`;

				connection.query(addPostTag, [postTagsValues], function (err) {
					if (err) throw err;

				
					if (imageuri.length > 0) {
						const postImageValues = imageuri.map(uri => [poid, uri]);
						const addImg = `INSERT INTO Images (post_id, image_url) VALUES ?`;

						connection.query(addImg, [postImageValues], function (err) {
							if (err) throw err;
							// console.log("okblog");
						});
					}
				});
			});
		});
	});
}







// uid.int ,title,content, savedImages[] ,tag[]
// insertblog(1,'oktitle', 'content ', ['url1', 'url2'], ['tag1', 'tag2']);

function loadposts(callback) {
	
	sql = "SELECT p.post_id, p.title, p.content, p.created_at, u.username, GROUP_CONCAT(t.tag_name) AS tags FROM Posts p  LEFT JOIN Users u ON p.user_id = u.user_id  LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id LEFT JOIN Tags t ON pt.tag_id = t.tag_id WHERE p.status = 'published'GROUP BY p.post_id, u.username ORDER BY p.created_at DESC ;"
	connection.query(sql, function(err, res) {
		if (err) throw err;
		callback(res)
	})

}


function loadposts(page = 1, perPage = 5, callback) {
    const offset = (page - 1) * perPage; 
    const sql = `
        SELECT p.post_id, p.title, p.content, p.created_at, u.username, GROUP_CONCAT(t.tag_name) AS tags 
        FROM Posts p  
        LEFT JOIN Users u ON p.user_id = u.user_id  
        LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id 
        LEFT JOIN Tags t ON pt.tag_id = t.tag_id 
        WHERE p.status = 'published'
        GROUP BY p.post_id, u.username 
        ORDER BY p.created_at DESC 
        LIMIT ? OFFSET ?
    `;
    connection.query(sql, [perPage, offset], function(err, res) {
        if (err) throw err;
        callback(res);
    });
}

// loadposts( function(ret) {
// 	console.log(ret[0].post_id)
// });




function userinfo(username, callback) {
	qOverall = `
		SELECT 
		   	u.user_id,
		    u.username,
		    u.email,
		    (SELECT COUNT(*) FROM Posts WHERE user_id = u.user_id AND status = 'published') AS post_count,
		    (SELECT GROUP_CONCAT(DISTINCT t2.tag_name ORDER BY t2.tag_name SEPARATOR ', ') 
		     FROM Post_Tags pt2 
		     JOIN Tags t2 ON pt2.tag_id = t2.tag_id 
		     JOIN Posts p2 ON pt2.post_id = p2.post_id 
		     WHERE p2.user_id = u.user_id AND p2.status = 'published') AS all_tags
		FROM Users u
		WHERE u.username = ?;
	`;

	qp = `
		SELECT 
		    p.post_id,
		    p.title,
		    p.content,
		    p.created_at,
		    u.username,
		    GROUP_CONCAT(t.tag_name) AS tags
		FROM Posts p
		JOIN Users u ON p.user_id = u.user_id
		LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id
		LEFT JOIN Tags t ON pt.tag_id = t.tag_id
		WHERE u.username = ? AND p.status = 'published'
		GROUP BY p.post_id, u.username ORDER BY p.created_at DESC ;
	`;

	connection.query(qOverall, [username], function(err, res) {
		if (err) throw err;
		connection.query(qp, [username], function(err, ret) {
			if (err) throw err;
			callback(res, ret)
		})
	})


}
// userinfo("bob", function(overall, p) {
// 	console.log(overall[0].user_id, p)
// })



// SELECT p.post_id, p.title, p.content, p.created_at, u.username, GROUP_CONCAT(t.tag_name) AS tags FROM Posts p LEFT JOIN Users u ON p.user_id = u.user_id  LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id LEFT JOIN Tags t ON pt.tag_id = t.tag_id WHERE p.status = 'published' AND u.username='bob' GROUP BY p.post_id, u.username;
function getuserpost(username, callback) {
	q = "SELECT p.post_id, p.title, p.content, p.created_at, u.username, GROUP_CONCAT(t.tag_name) AS tags FROM Posts p LEFT JOIN Users u ON p.user_id = u.user_id  LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id LEFT JOIN Tags t ON pt.tag_id = t.tag_id WHERE p.status = 'published' AND u.username=? GROUP BY p.post_id, u.username ORDER BY p.created_at DESC;"
	userexist(username, function(ret) {	
		if (ret) {
			connection.query(q, [username], function(err, res) {
				if (err) callback(false);
				if (res.length == 0 ) {
					callback(null);
				}else{
					callback(res);
				}
			})
		}else {
			callback(false)
		}
	}) 

}


function delpost(uid,pid, callback) {
	q = `
		 DELETE from Posts where post_id= ? and user_id= ? ;
	`;
	connection.query(q, [pid, uid], function(err, ret) {
		if (err) throw err;
		callback(true)
	})

}

// getuserpost("bob", console.log)


function searchp(qr, callback) {
	q = `
		SELECT 
		    p.post_id, 
		    p.title, 
		    p.content, 
		    p.created_at, 
		    u.username, 
		    COALESCE(GROUP_CONCAT(DISTINCT t.tag_name ORDER BY t.tag_name SEPARATOR ', '), '') AS tags
		FROM Posts p  
		LEFT JOIN Users u ON p.user_id = u.user_id  
		LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id 
		LEFT JOIN Tags t ON pt.tag_id = t.tag_id 
		WHERE p.status = 'published'
		AND (
		    p.title LIKE CONCAT('%', ?, '%') 
		    OR p.content LIKE CONCAT('%', ?, '%') 
		    OR t.tag_name LIKE CONCAT('%', ?, '%')
		)
		GROUP BY p.post_id, u.username
		ORDER BY p.created_at DESC;
	`;
	connection.query(q, [qr, qr, qr], function(err, res) {
		if (err) callback(false);

		// console.log(res)
		qauth = `
			SELECT u.username, COUNT(p.post_id) AS post_count
			FROM Users u
			LEFT JOIN Posts p ON u.user_id = p.user_id
			WHERE u.username LIKE CONCAT('%', ?, '%')
			GROUP BY u.username;
		`;
		connection.query(qauth, [qr], function(err, ret) {
			if (err) throw err;
			if (res.length > 0) {
				callback(res,ret)
			}else{
				callback(false)
			}
		})
	})
}

// searchp("bob", (blog, author) => {
// 	console.log(blog, author);
// });






function getpostbyid(bid, callback) {
	q = "SELECT p.post_id, p.title, p.content, p.created_at, u.username, GROUP_CONCAT(t.tag_name) AS tags FROM Posts p LEFT JOIN Users u ON p.user_id = u.user_id  LEFT JOIN Post_Tags pt ON p.post_id = pt.post_id LEFT JOIN Tags t ON pt.tag_id = t.tag_id WHERE p.status = 'published' AND p.post_id = ? GROUP BY p.post_id, u.username LIMIT 1"

	connection.query(q, [bid], function (err, res) {
		if (err) callback(false);
		if (res.length > 0) {

			callback(res);
		}else {
			callback(false)
		}
	})

}


// getpostbyid(1, function(ret) {
// 	console.log(ret[0].tags.split(','))
// })



function securepost(content) {
    return sanitizeHtml(content, {
        allowedTags: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img'],
        allowedAttributes: {
            'a': ['href', 'title', 'target'],
            'img': ['src', 'alt']
        },
        disallowedTagsMode: 'discard', 
        enforceHtmlBoundary: true, 
        allowVulnerableTags: true, 
        transformTags: {
            'img': (tagName, attribs) => {
                if (!attribs.src || attribs.src.startsWith('javascript:')) {
                    return { tagName: 'img', attribs: {} }; // Strip bad images
                }
                return { tagName, attribs };
            }
        }
    });
}



async function checkimg(base64String) {
    try {

        const buffer = Buffer.from(base64String, 'base64');

        if (!buffer || buffer.length === 0) {
            console.log('Invalid Base64 data');
            return { valid: false, reason: 'Invalid Base64 data' };
        }
        if (buffer.length > 5 * 1024 * 1024) {
           
            return { valid: false, reason: 'File size exceeds 5MB' };
        }

        const cfileType = await fileType.fromBuffer(buffer);



        if (!cfileType || !cfileType.mime.startsWith('image/')) {
            console.log('Not a valid image');
            return { valid: false, reason: 'Not a valid image' };
        }


        return { valid: true, mime: cfileType.mime };
    


    } catch (error) {
        console.log('Invalid B');
        return { valid: false, reason: 'Invalid Base64 or image' };
    }
}








async function processContent(content) {
    const imgRegex = /<img src="data:image\/(png|jpeg|jpg|gif);base64,([^"]+)">/g;
    let savedImages = [];
    
    
    content = content.replace(imgRegex, (match, extension, base64Data) => {
        const hash = crypto.createHash('md5').update(base64Data).digest('hex');
        

        const filename = `${Date.now()}_${hash}.${extension}`;
        const filepath = path.join(__dirname, 'public/bgimgs/', filename);
        
        const imageurl = `/bgimgs/${filename}`;
        // console.log(imageurl)
        const buffer = Buffer.from(base64Data, 'base64');
        const image = sharp(buffer);
        image.withMetadata().toBuffer().then((sanitizedBuffer) => {
            fs.writeFileSync(filepath, sanitizedBuffer);
        });

 
        checkimg(base64Data).then(({ valid }) => {
            if (!valid) {
                console.log("Invalid image detected");
            }
        });

        savedImages.push(imageurl);
        // console.log("fiiiiiiiiiiiiiiiiiiiiiiion")
    
        return `<img src="${imageurl}" >`;
    });

    return { content, savedImages, stat: true };
}

function checksession(req, res, next) {
    if (!req.session.user) {

        return res.redirect("/login");
    } else if (!req.session.user) {
    	return res.redirect("/login");
    }
    next();
}





app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("login");
    });
});



app.get("/login",  (req, res) => {
	
	res.render('login.ejs', {message: ''});
});

app.post("/login", (req, res) => {
	const {username, password} = req.body;
	var message = ''; 
	// console.log(username,password);
	auth(username,password, function(stat) {
			// console.log(stat);
			if (stat) {
				userinfo(username, function(ov, p) {
					req.session.user = { username, uid:  ov[0].user_id};
					
					// console.log(req.session)
					// req.session.uid = {ov[0].user_id};

					res.redirect('/');	
				})
			}else {
				res.render('login.ejs', { message: "Invalid username or password" });
			}
	});


})

app.get("/", (req, res) => {
	const page = parseInt(req.query.page) || 1;
	const perPage = 6;
	
	loadposts(page, perPage, function(ret) {
		const countq = `SELECT COUNT(*) AS total FROM Posts WHERE status = 'published'`;
		connection.query(countq, (err, result) => {
			if (err) throw err;
			const totalPosts = result[0].total;
        	const totalPages = Math.ceil(totalPosts / perPage);

			res.render('index.ejs', {blog: ret, data: req.session.user || false, currentPage: page, totalPages, message: ""});
		})
	});
	
})

app.get("/my", checksession, (req, res) => {
	var username = req.session.user.username;
	

	userinfo(username, function(ov, p) {
		if (req.session.message) {
			const message = req.session.message;
			req.session.message = null;
			return res.render("my.ejs", {data: req.session.user, udata : ov[0] ,blog : p, message: message});
		}else {

			return res.render("my.ejs", {data: req.session.user, udata : ov[0]  ,blog : p, message: ""});
		}
						
	})
});

app.post('/my', checksession, (req, res) => {

	if (req.body.username) {
		const newname = req.body.username;
		
		const prevname = req.session.user.username;
		if (newname !== prevname) {

			q = `
				UPDATE Users SET username = ? WHERE username= ?; 
			`;
			connection.query(q, [newname, prevname], function(err , resp) {
				if (err) {
					req.session.message = "User already exists";
					return res.redirect("/my")
				};
				req.session.message = "Success!";
				
				req.session.destroy(() => {
        			return res.redirect("login");
    			});
				
			})

		}else {
			req.session.message = "Fail! Tried to change to same name!";
			return res.redirect("/my")
		}
		

	}else if (req.body.email) {
		const email = req.body.email[0];
		const uname = req.session.user.username;
		const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		// not strict enough, check if domain exiss (dns mx),...  ,
	    if (!emailPattern.test(email)) {
	    	req.session.message = "Fail! Invalid email format";
			return res.redirect("/my")
	        
	    }else {
	    	qe = `update Users set email = ? where username = ?`;
	    	connection.query(qe, [email, uname], function(err, eres) {
	    		if (err) {
					req.session.message = "Coudnt change password, We f up";
					return res.redirect("/my")
				}else {
					req.session.message = "Success!";
					return res.redirect("/my")
				}
	    	}); 
	    }

		
	} else  {
		const uname = req.session.user.username;
		const { newpassword, confirmpassword} = req.body;
		const Hnewpass = sha256(newpassword)
		if (newpassword !== confirmpassword) {
			req.session.message = "Confirm password Fail";
			return res.redirect("/my")
		}else {
			qp = `update Users set password = ? where username = ?`; 
			connection.query(qp, [Hnewpass, uname], function(err, resps) {
				if (err) {
					req.session.message = "Coudnt change password, We f up";
					return res.redirect("/my")
				}else {
					req.session.destroy(() => {
        				return res.redirect("login");
    				});
				}
			})
		}
		
		
	}
	// res.redirect('/my')
})

app.get("/my/dlp/:pid", checksession, (req, res) => {
    
    

    const pid = parseInt(req.params.pid) || 0;
   
    var uid = req.session.user.uid;

    delpost(uid, pid , function(ret) {
    	// console.log(ret)
    	res.redirect("/my")
    
    })

	
});




app.get("/register", (req, res) => {
	res.render('register.ejs', {message: ''});
});
app.post('/register', (req, res) => {
	const {username, password, email, confirmpassword} = req.body;
	const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		// not strict enough, check if domain exiss (dns mx),...  ,
	    if (!emailPattern.test(email)) {
			res.render('register.ejs', {message: 'Invalid email'});
	        
	    }
	if (confirmpassword !== password) {
			res.render('register.ejs', {message: 'Sneaky basterd'});
	}
	registerUser(username, password, email, function(stat) {
		if (stat) {
			res.redirect('/login')		
		}else {
			res.render('register.ejs', {message: 'User already exists!'});
		}
	})

});


app.get("/post", checksession, (req, res ) => {
	res.render("post.ejs")
})
app.post("/post", checksession ,async (req, res ) => {
	// console.log("hit");
	uid = req.session.user.uid;
	const {title, content, tags} = req.body;
	// console.log(title)
	// console.log(content)

	const { content:  processedContent, savedImages, stat } =  await processContent(content);

	const safecontent = securepost(processedContent);
	const safetitle = securepost(title)
	let parsetag = JSON.parse(tags)




	if (stat) {

		// insertblog(1,'oktitle', 'html content ', ['url1', 'url2'], ['tag1', 'tag2']);
		if (parsetag.length > 0 ) {

			insertblog(uid, safetitle, safecontent, savedImages, parsetag);
		}else {
			insertblog(uid, safetitle, safecontent, savedImages, ["NoTag"]);
		}
	}else {
		// console.log("error while posting")
		res.render("post.ejs", {message : "Problem while uploading post"})
	}

	res.render("post.ejs", {message : ""})
	
})


app.get('/blogs/:bid', function(req, res, next){
	post_id = parseInt(req.params.bid) || 0;
	getpostbyid(post_id,  function (ret) {
	
		if (ret) {
			try {
				tag = ret[0].tags.split(',')
			}catch(error) {
				tag = ["Blogcms"]
			}
			res.render("p.ejs", {message: "", post: ret[0], tag})
		}else{
			res.render("404.ejs")
		}
	}) 

});







app.get("/search", (req, res) => {
	
    const s = req.query.sr;
    if (s) {

	 searchp(s, (blog, author) => {
		// console.log(blog, author);

		res.render("search.ejs", {blog, author})
	});

    }else {

    	res.render("search.ejs", {blog: false, author: false})
    }

    
})

app.get("/profile/:user", (req, res, next) => {
	username = req.params.user
	userexist(username, function(stat) {
		if (stat) {
			getuserpost(username, function(ret) {
				if (ret === null) {
					// user no content
					res.render("profile.ejs", {data : ["User have no Content"]});
				}else if (ret) {
					
					res.render("profile.ejs", {data : ret})
				}else {
					res.render("profile.ejs", {data : ["Could't Get User content "]})
				}
			})
		}else {
			// send 404
			res.render("404.ejs")
		}
	})
})



app.use((req, res) => {
    res.status(404).render("404.ejs");
});
app.use((err, req, res, next) => {
    console.error(err.stack);  
    res.status(500).render("500.ejs"); 
});




app.listen(9001, 'localhost');
// Developed by Netneal Amsalu(N7y)