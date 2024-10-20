// Required dependencies
const { MongoClient } = require("mongodb");
const express = require('express');
const bodyParser = require('body-parser');
const formidable = require('formidable');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app and HTTP server with Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (like CSS) from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname + "/public"));

// MongoDB connection URI
const uri = "mongodb+srv://babyshop:SC6VvHOlPVMffs6j@babyshop.odvjo.mongodb.net/?retryWrites=true&w=majority&appName=BabyShop";

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/files', express.static('files'));
app.use('/files', express.static(path.join(__dirname, 'files')));

// Serving static files
app.get('/images/Graphicloads-100-Flat-2-Chat-2.ico', (req, res) => {
    res.sendFile(path.join(__dirname, '/images/Graphicloads-100-Flat-2-Chat-2.ico'));
});
app.get('/js/jquery-3.4.1.min.js', (req, res) => {
    res.sendFile(path.join(__dirname, '/js/jquery-3.4.1.min.js'));
});
app.get('/js/e-commerce.js', (req, res) => {
    res.sendFile(path.join(__dirname, '/js/e-commerce.js'));
});

// Chat route
app.get("/chat", (req, res) => {
    res.sendFile(__dirname + "/public/indexchat.html");
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});
app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, '/cart.html'));
});
app.get('/indexchat', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/indexchat.html'));
});
app.get('/addproduct', (req, res) => {
    res.sendFile(path.join(__dirname, '/addproduct.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('a user connected');
    
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
});

// MongoDB Functions
async function getProducts() {
    const client = new MongoClient(uri);
    try {
        await client.connect(); 
        const database = client.db('BabyShop');
        const products = database.collection('product');
        return await products.find().toArray();
    } finally {
        await client.close(); 
    }
}

async function getProduct(_code) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('BabyShop');
        const products = database.collection('product');
        const query = { code: _code };
        return await products.findOne(query);
    } finally {
        await client.close();
    }
}

async function addSalesOrder(data) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('BabyShop');
        const SalesOrders = database.collection('SalesOrder');

        let docs = data.products.map(product => ({
            customer: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            code: product.code,
            price: product.price,
            qty: product.qty,
            total: product.total,
            date: new Date()
        }));

        const options = { ordered: true };
        await SalesOrders.insertMany(docs, options);
    } finally {
        await client.close();
    }
}

// API Routes
app.get('/api/product', async (req, res) => {
    try {
        const product = await getProduct(req.query.code);
        res.send(product);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await getProducts();
        res.send(products);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/createsales', async (req, res) => {
    try {
        await addSalesOrder(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// File upload route
app.post('/uploadfile', (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req);

    form.on('fileBegin', (name, file) => {
        file.path = path.join(__dirname, '/files/', file.name);
    });

    form.on('file', (name, file) => {
        const strFilePath = '/files/' + file.name;
        res.json({ "filePath": strFilePath, "fileName": file.name });
    });
});

// New route to handle adding a product
app.post('/addproduct', (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            console.error('Form parsing error:', err);
            return res.status(500).json({ error: 'Form parsing error' });
        }
        
        const productData = {
            code: fields.product_code,
            name: fields.product_name,
            price: fields.price,
            path: files.product_image.path // Correct field for image path
        };

        console.log('Product Data:', productData);

        try {
            const client = new MongoClient(uri);
            await client.connect();
            const database = client.db('BabyShop');
            const products = database.collection('product');

            const result = await products.insertOne(productData);
            console.log("Product added successfully:", result.insertedId);
            res.json({ message: 'Product added successfully', data: productData });
        } catch (error) {
            console.error("Error inserting product into MongoDB:", error);
            res.status(500).json({ error: 'Database error' });
        }
    });
});

// Chat functionality
io.on('connection', function(socket){
    console.log('User Connected...');
    socket.on('message', (msg) => {
        socket.to(socket.room).emit('message', msg);
    });

    socket.on('adduser', function(username, roomname){
        socket.join(roomname);
        socket.room = roomname;
        socket.username = username;
        io.sockets.in(socket.room).emit('updateusers', username);

        socket.emit('greeting', username);
    });

    socket.on('uploadImage', function(data, username) {
        socket.to(socket.room).emit('publishImage', data, username);
    });

    socket.on('disconnect', function() {
        console.log("User Disconnected");
        socket.leave(socket.room);
        io.sockets.in(socket.room).emit('updateusers', null);
    });
});

// Start server
server.listen(30, () => {
    console.log('Server listening on *:30');
});
