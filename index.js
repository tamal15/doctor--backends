const express = require('express')
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
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


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ev8on.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri)


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });



async function run(){
    try{
       await client.connect();
       console.log('database connect')
      const database=client.db('doctor_portal')
      const appointmentCollection=database.collection('appointment')
      const registerCollection=database.collection('register')
      const othersPaymentCollection=database.collection('othersPayment')
      const productCollection=database.collection('medicin')
     
      // app get 
      app.get('/appointments', async(req,res)=>{
        const email=req.query.email
        const date=req.query.date;
        const query={email:email, date:date}
        const cursor=appointmentCollection.find(query)
        const appointment=await cursor.toArray()
        res.json(appointment)
      })


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
      success_url: 'https://enigmatic-citadel-27942.herokuapp.com/success',
      // success_url: 'http://localhost:5000/success',
      fail_url: 'https://enigmatic-citadel-27942.herokuapp.com/fail',
      cancel_url: 'https://enigmatic-citadel-27942.herokuapp.com/cancel',
      ipn_url: 'https://enigmatic-citadel-27942.herokuapp.com/ipn',
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
  const sslcommer = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD,false) //true for live default false for sandbox
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

app.get('/orders/:tran_id', async(req,res)=>{
  const id=req.params.tran_id;
  const order =await othersPaymentCollection.findOne({tran_id:id});
  console.log(order)
  res.json(order)
})



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
      })
      
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