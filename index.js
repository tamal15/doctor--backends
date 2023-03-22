const express = require('express')
const admin = require("firebase-admin");
// const { MongoClient } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');
const ObjectId=require('mongodb').ObjectId;
const { v4: uuidv4 } = require('uuid');
// const SSLCommerzPayment = require('sslcommerz')
require('dotenv').config()
//  payment 

const stripe = require("stripe")(process.env.STRIPE_SECRET)
const cors = require('cors')




const app = express()
const port =process.env.PORT || 5000;
const SSLCommerzPayment = require('sslcommerz')
app.use(express.urlencoded({ extended: true }));

// doctor-portal-firebase-adminsdk-fb393-1696fcd38a.json 


const serviceAccount = require('./doctor-portal-firebase-adminsdk-fb393-1696fcd38a.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


async function verifyToken(req,res,next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token=req.headers.authorization.split(' ')[1];

    try{
     const decodedUser=await admin.auth().verifyIdToken(token);
     req.decodedEmail=decodedUser.email
    }
    catch{

    }
  }
  next()
}

app.use(cors())
app.use(express.json())


const uri = "mongodb+srv://doctorPortal:q7D8j87kHYXlZSdl@cluster0.ev8on.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ev8on.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri)


// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });



async function run(){
    try{
       await client.connect();
       console.log('database connect')
      const database=client.db('doctor_portal')
      const appointmentCollection=database.collection('appointment')
      const registerCollection=database.collection('register')
      const othersPaymentCollection=database.collection('othersPayment')
      const productCollection=database.collection('medicin')
      const doctorCollection=database.collection('doctor')
      const adminuploadMedicinCollection=database.collection('adminMedicin')
      const adminBuyPaymentCollection=database.collection('UserProductPaymnet')
      const ambulanceCollection=database.collection('ambulanceServices')
     
      // app get 
      app.get('/appointments', async(req,res)=>{
        const email=req.query.email
        const date=req.query.date;
        const query={email:email, date:date}
        const cursor=appointmentCollection.find(query)
        const appointment=await cursor.toArray()
        res.json(appointment)
      })

      //    post doctor 
      app.post('/postdoctor', async(req,res) =>{
        const user=req.body;
      console.log(user);
      
        const result=await doctorCollection.insertOne(user);
        res.json(result)
    });

    // get doctor

    app.get("/getDoctors", async (req, res) => {
      const page = req.query.page;
      const size = parseInt(req.query.size);
      const query = req.query;
      delete query.page
      delete query.size
      Object.keys(query).forEach(key => {
          if (!query[key])
              delete query[key]
      });

      if (Object.keys(query).length) {
          const cursor = doctorCollection.find(query, status = "approved");
          const count = await cursor.count()
          const allQuestions = await cursor.skip(page * size).limit(size).toArray()
          res.json({
              allQuestions, count
          });
      } else {
          const cursor = doctorCollection.find({
              // status: "approved"
          });
          const count = await cursor.count()
          const allQuestions = await cursor.skip(page * size).limit(size).toArray()

          res.json({
              allQuestions, count
          });
      }

  });


      //  payment method of api get 
     app.get('/appointments/:id', async(req,res)=>{
       const id=req.params.id
       console.log(req.params.id)
       const query={_id:ObjectId(id)}
       const result=await appointmentCollection.findOne(query)
       res.json(result)
     })


      app.post('/appointments', async(req,res) =>{
        const appointment=req.body;
        const result=await appointmentCollection.insertOne(appointment)
        console.log(result)
        res.json(result)
      })

      // appointment payment add update app put 
      app.put('/appointments/:id',async(req,res)=>{
        const id=req.params.id;
        const payment=req.body;
        const query={_id:ObjectId(id)}
        const updateDoc={
          $set:{
            payment:payment
          }
        }
        const result=await appointmentCollection.updateOne(query,updateDoc)
        res.json(result)
      })



    //  user register information store database 
       app.post('/register', async(req,res)=>{
         const register=req.body;
         const result=await registerCollection.insertOne(register)
         console.log(result)
         res.json(result)
       })


       


      //  google login user update only one user database store 
      app.put('/register', async(req,res)=>{
        const user=req.body;
        const filter={email:user.email}
        const options = { upsert: true };
        const updateDoc={$set:user}
        const result=await registerCollection.updateOne(filter,updateDoc,options)
        res.json(result)
      });

      // database update admin role 
      app.put('/register/admin', verifyToken, async(req,res)=>{
        const user=req.body;
        console.log('decodedEmail', req.decodedEmail)
        const reqester= req.decodedEmail
        if(reqester){
          const reqesterAccount=await registerCollection.findOne({email:reqester});
          if(reqesterAccount.role==='admin'){
            const filter={email:user.email}
            const updateDoc={$set:{role:'admin'}}
            const result=await registerCollection.updateOne(filter,updateDoc)
            res.json(result)
 
          }
        }
        else{
          res.status(403).json({message:'you do not have access to make admin'})
        }

      });

      // database admin check korbo 
      app.get('/register/:email', async(req,res)=>{
        const email=req.params.email;
        const query={email:email}
        const user=await registerCollection.findOne(query)
        let isAdmin=false
        if(user?.role==='admin'){
          isAdmin=true
        }
        res.json({admin:isAdmin})
      })


      // bikash payment start 

      //sslcommerz init
app.post('/init', async(req, res) => {
  // console.log(req.body)
  const data = {
      total_amount: req.body.total_amount,
      currency: 'BDT',
      tran_id: uuidv4(),
      success_url: 'https://doctor-backends.up.railway.app/success',
      // success_url: 'http://localhost:5000/success',
      fail_url: 'https://doctor-backends.up.railway.app/fail',
      cancel_url: 'https://doctor-backends.up.railway.app/cancel',
      ipn_url: 'https://doctor-backends.up.railway.app/ipn',
      shipping_method: 'Courier',
      paymentStatus:'panding',
      product_name: req.body.product_name,
      product_category: 'Electronic',
      product_profile: 'general',
      cus_name: req.body.cus_name,
      cus_email: req.body.cus_email,
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: '01711111111',
      cus_fax: '01711111111',
      ship_name: 'Customer Name',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
      multi_card_name: 'mastercard',
      value_a: 'ref001_A',
      value_b: 'ref002_B',
      value_c: 'ref003_C',
      value_d: 'ref004_D'
  };
  // console.log(data)
  // insert data into database 
  const order=await othersPaymentCollection.insertOne(data)
  const sslcommer = new SSLCommerzPayment(process.env.STORES_ID, process.env.STORES_PASSWORD,false) //true for live default false for sandbox
  sslcommer.init(data).then(data => {
      //process the response that got from sslcommerz 
      //https://developer.sslcommerz.com/doc/v4/#returned-parameters
      // console.log(data)
      if(data.GatewayPageURL){
        res.json(data.GatewayPageURL)
      }
      else{
        return res.status(400).json({
          message:'payment session failed'
        })
      }
     
  });
})

app.post ('/success', async(req,res)=>{
  // console.log(req.body);
  const order = await othersPaymentCollection.updateOne({tran_id:req.body.tran_id},{
    $set:{
      val_id:req.body.val_id
    }

  })
  // res.status(200).redirect(`https://doctor-portal-5534a.web.app/success/${req.body.tran_id}`)
  res.status(200).redirect(`https://doctor-portal-5534a.web.app/success/${req.body.tran_id}`)
})
app.post ('/fail', async(req,res)=>{
  // console.log(req.body);
const order=await othersPaymentCollection.deleteOne({tran_id:req.body.tran_id})
  res.status(400).redirect(`https://doctor-portal-5534a.web.app`)
})
app.post ('/cancel', async(req,res)=>{
  // console.log(req.body);
  const order=await othersPaymentCollection.deleteOne({tran_id:req.body.tran_id})
  res.status(200).redirect(`https://doctor-portal-5534a.web.app`)
})

// payment validate check and status update for pading to confarm 
app.post('/validate', async(req,res)=>{
  console.log(req.body)
  const order =await othersPaymentCollection.findOne({tran_id:req.body.tran_id});
  console.log(order)
  if(order.val_id === req.body.val_id){
    const update = await othersPaymentCollection.updateOne({tran_id:req.body.tran_id},{
      $set:{
        paymentStatus:'paid'
      }
    })
    res.send(update.modifiedCount>0)
  }
  else{
    res.send('payment not confirmed. appointment discarded')
  }
})

// token start

app.get("/init",async(req,res)=>{
  console.log(req.params.email)
  const store=othersPaymentCollection.find({})
  const result=await store.toArray()
  // const result=await othersPaymentCollection.find(store).toArray()
  res.send(result)

})


// token end 



app.get('/orders/:tran_id', async(req,res)=>{
  const id=req.params.tran_id;
  const order =await othersPaymentCollection.findOne({tran_id:id});
  console.log(order)
  res.json(order)
})

// push tge data doctor portal ad 

      // bikash payment end 


      //  payment method type post 
       app.post('/create-payment-intent',async(req,res)=>{
         const paymentInfo=req.body;
         const amount=paymentInfo.price * 100;
         const paymentIntent =await stripe.paymentIntents.create({
           currency:'usd',
           amount:amount,
           payment_method_types:['card']

         });
         res.json({ clientSecret: paymentIntent.client_secret })
       });


      //  add product post database store
      app.post('/user', async(req,res)=>{
        const service=req.body;
        console.log("hit the api",service)

        const result=await productCollection.insertOne(service)
        console.log(result);
        res.json(result)
      })

      // add product database theke data gulo niye asbo 
      app.get('/user',async(req,res)=>{
        const cursor=productCollection.find({})
        const services=await cursor.toArray();
        res.send(services)
      });


      // product details page 
      app.get('/user/:id', async(req,res)=>{
        const id=req.params.id;
        const query={_id:ObjectId(id)};
        const service=await productCollection.findOne(query);
        res.json(service)
      });

      // patient appointment database theke data niye asbo 
      // app.get('/patient', async(req,res)=>{
      //   const cursor=appointmentCollection.find({});
      //   const result= await cursor.toArray();
      //   res.send(result)
      // });

      
      // app get 
      app.get('/patient', async(req,res)=>{
        // const email=req.query.email
        const date=req.query.date;
        // const date=new Date(req.query.date).toLocaleDateString();
        console.log(date)
        const query={ date:date}
        console.log(query)
        const cursor=appointmentCollection.find(query)
        const appointment=await cursor.toArray()
        res.json(appointment)
      });


      // admin upload medicin 
      app.post('/postadminProduct', async(req,res) =>{
        const user=req.body;
      console.log(user);
      
        const result=await adminuploadMedicinCollection.insertOne(user);
        res.json(result)
    });

    // get show medicin 
    app.get('/postBuyer', async(req,res)=>{
      const result=await adminuploadMedicinCollection.find({}).toArray()
      res.json(result)
  });




  // user buy product sssl commerce 
  //sslcommerz init
app.post('/inits', async(req, res) => {
  // console.log(req.body)
  const email=req.body.cartProducts.map((data)=>data.buyerEmail)
  const schedule=req.body.cartProducts.map((data)=>data.schedule)
  const adminemail=req.body.cartProducts.map((data)=>data.adminEmail)
  // console.log(email)
  // console.log(schedule)
  const data = {
      emails:email,
      admindata:adminemail,
      total_amount: req.body.total_amount,
      currency: req.body.currency,
      tran_id: uuidv4(),
      success_url: 'https://doctor-backends.up.railway.app/successs',
      fail_url: 'https://doctor-backends.up.railway.app/fail',
      cancel_url: 'https://doctor-backends.up.railway.app/cancel',
      ipn_url: 'http://yoursite.com/ipn',
      shipping_method: 'Courier',
      product_name: "req.body.product_name",
      product_category: 'Electronic',
      product_profile: "req.body.product_profile",
      cus_name: req.body.cus_name,
      cus_email: req.body.cus_email,
      date: req.body.date,
      
      status: req.body.status,
      cartProducts: req.body.cartProducts,
      // buyerDetails: req.body.email,
      // buyerDetails: req.body.console.log(cartProducts),
      product_image: "https://i.ibb.co/t8Xfymf/logo-277198595eafeb31fb5a.png",
      cus_add1: req.body.cus_add1,
      cus_add2: 'Dhaka',
      cus_city: req.body.cus_city,
      schedules: req.body.schedules,
      purchase: req.body.purchase,
      cus_state:  req.body.cus_state,
      cus_postcode: req.body.cus_postcode,
      cus_country: req.body.cus_country,
      cus_phone: req.body.cus_phone,
      cus_fax: '01711111111',
      ship_name: 'Customer Name',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
      multi_card_name: 'mastercard',
      value_a: 'ref001_A',
      value_b: 'ref002_B',
      value_c: 'ref003_C',
      value_d: 'ref004_D'
  };
  // insert order data into database 
  const order=await adminBuyPaymentCollection.insertOne(data)
  // console.log(data)
  const sslcommer = new SSLCommerzPayment(process.env.STORES_ID,process.env.STORES_PASSWORD,false) //true for live default false for sandbox
  sslcommer.init(data).then(data => {
      //process the response that got from sslcommerz 
      //https://developer.sslcommerz.com/doc/v4/#returned-parameters
      // console.log(data);
      // res.redirect(data.GatewayPageURL)
      if(data.GatewayPageURL){
          res.json(data.GatewayPageURL)
        }
        else{
          return res.status(400).json({
            message:'payment session failed'
          })
        }
  });
})

app.post('/successs',async(req,res)=>{
  // console.log(req.body)
  const order = await adminBuyPaymentCollection.updateOne({tran_id:req.body.tran_id},{
      $set:{
        val_id:req.body.val_id
      }
  
    })
  res.status(200).redirect(`https://doctor-portal-5534a.web.app/successs/${req.body.tran_id}`)
  // res.status(200).json(req.body)
})

app.post ('/fail', async(req,res)=>{
  // console.log(req.body);
const order=await adminBuyPaymentCollection.deleteOne({tran_id:req.body.tran_id})
  res.status(400).redirect('https://doctor-portal-5534a.web.app')
})
app.post ('/cancel', async(req,res)=>{
  // console.log(req.body);
  const order=await adminBuyPaymentCollection.deleteOne({tran_id:req.body.tran_id})
  res.status(200).redirect('https://doctor-portal-5534a.web.app')
})


app.get('/payorders/:tran_id', async(req,res)=>{
  const id=req.params.tran_id;
  console.log(id)
  const order =await adminBuyPaymentCollection.findOne({tran_id:id});
  console.log(order)
  res.json(order)
});



// get product admin medicin show 
 app.get("/adminMedicin", async (req, res) => {
        const page = req.query.page;
        const size = parseInt(req.query.size);
        const query = req.query;
        delete query.page
        delete query.size
        Object.keys(query).forEach(key => {
            if (!query[key])
                delete query[key]
        });

        if (Object.keys(query).length) {
            const cursor = adminuploadMedicinCollection.find(query, status = "approved");
            const count = await cursor.count()
            const allQuestions = await cursor.skip(page * size).limit(size).toArray()
            res.json({
                allQuestions, count
            });
        } else {
            const cursor = adminuploadMedicinCollection.find({
                // status: "approved"
            });
            const count = await cursor.count()
            const allQuestions = await cursor.skip(page * size).limit(size).toArray()

            res.json({
                allQuestions, count
            });
        }

    });


    // ambulance post data 
      //    post product admin burger
        app.post('/PostAmbulance', async (req, res) => {
            const user = req.body;
            const result = await ambulanceCollection.insertOne(user);
            res.json(result)
        });
         app.get('/PostAmbulance', async(req,res)=>{
            const result=await ambulanceCollection.find({}).toArray()
            res.json(result)
        });

        app.put('/services', async (req, res) => {
        
            console.log(req.body)
            // const filter = { _id: ObjectId(req.params.id) };
            const query={
                branch:req.body.branch}
            const options = { upsert: true };
            // const data=req.body
           
               
                    const updateDoc = { $push: { services: req.body } };
                    const result = await ambulanceCollection.updateOne(query, updateDoc, options);
                    res.json(result)
                
              


    });


    // ambulance show 

    app.get("/branch", async (req, res) => {
      const page = req.query.page;
      const size = parseInt(req.query.size);
      const query = req.query;
      delete query.page
      delete query.size
      Object.keys(query).forEach(key => {
          if (!query[key])
              delete query[key]
      });

      if (Object.keys(query).length) {
          const cursor = ambulanceCollection.find(query, status = "approved");
          const count = await cursor.count()
          const allData = await cursor.skip(page * size).limit(size).toArray()
          res.json({
              allData, count
          });
      } else {
          const cursor = ambulanceCollection.find({
              // status: "approved"
          });
          const count = await cursor.count()
          const allData = await cursor.skip(page * size).limit(size).toArray()

          res.json({
              allData, count
          });

          app.get('/branch/:id', async (req, res) => {
            const id = req.params.id;
            const result = await ambulanceCollection.findOne({ _id: ObjectId(id) });
            res.json(result)
        });
      }

  });







      
    }


    

    // bikash payment start

    


    // bikash payment end 
    finally{
    //    await client.close();
    }

}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('welcome doctor-portal!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})