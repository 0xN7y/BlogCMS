const mysql = require('mysql2');
const fs = require('fs');

const loadconfigg = (conf) => {
    try {
        const data = fs.readFileSync(conf, 'utf8'); 
        return JSON.parse(data); 
    } catch (err) {
        console.error("setup file not found:", err);
        return null;
    }
};

const connection = mysql.createConnection({
  host: conf["host"],     
  user: conf["user"], 
  password: conf["password"], 
  database: 'blogcms',
  multipleStatements: true
});




const conf = loadconfigg('./setupconfig.json');


cu = `CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`




connection.query(cu , function(err, stat) {
    if (err) throw err;
    
})



cpt = `CREATE TABLE Posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, 
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, 
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
)`;

connection.query(cpt, function(err, stat) {
    if (err) throw err;
})


ct = `CREATE TABLE Tags (
    tag_id INT AUTO_INCREMENT PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

connection.query(ct, function(err, ret) {
    if (err) throw err;
})

posttag = `CREATE TABLE Post_Tags (
    post_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES Tags(tag_id) ON DELETE CASCADE
);`

connection.query(posttag, function (err, res) {
    if (err) throw err;
})


img = `CREATE TABLE Images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL, 
    image_url VARCHAR(255) NOT NULL, 
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE
);`

connection.query(img, function (err, resp) {
    if (err) throw err;
})

console.log("Success!")