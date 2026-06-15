import mongoose from "mongoose";


const userSchema = mongoose.Schema({
    name : String,
    email : String,
    password : String,
    token : String,
    
})

const User = mongoose.model("User", userSchema);

export {User}   
