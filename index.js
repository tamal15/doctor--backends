const express = require('express')
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
const ObjectId=require('mongodb').ObjectId
require('dotenv').config()
//  payment 

const stripe = require("stripe")(process.env.STRIPE_SECRET)
const cors = require('cors')




const app = express()
const port =process.env.PORT || 5000;

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
       })
      
    }
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