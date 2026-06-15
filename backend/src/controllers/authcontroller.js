
import validator from "validator";
import bcrypt from "bcrypt";
import { genToken } from "../config/token.js";
import { User } from "../models/authmodel.js";
const signup = async (req, res)=>{


    const {name, email, password} = req.body;

    if(!name || !email || !password){
        return res.status(400).json({message : "All fields are required"})
    }
    if(!validator.isEmail(email))
    {
        return res.status(400).json({message : "Email is not valid"})
    }
    if(!validator.isStrongPassword(password)){
        return res.status(400).json({message : "Password is not strong"})

    }
     

    try{
        const user = await User.findOne({email});
        if(user){
            return res.status(400).json({message : "User already exists"})
        }

        const hashpassword = await bcrypt.hash(password, 10);
        const token = genToken();

        const newUser = await User.create({
            name,
            email,
            password: hashpassword,
            token
        });

        res.cookie("token", token, {
            maxAge : 1000 * 60 * 60 * 24 * 7,
            httpOnly : true,
            secure : process.env.NODE_ENV === "production",
        });

        return res.status(201).json({message : "User created successfully", user: newUser});
    }catch(err){
        console.error(err);
        return res.status(500).json({message : "Internal server error"})
    }
};


const login = async (req, res)=>{
    const {email, password} = req.body;
    if(!email || !password){
        return res.status(400).json({message : "All fields are required"})
    }
    if(!validator.isEmail(email)){
        return res.status(400).json({message : "Email is not valid"})
    }
    try{
        const user = await User.findOne({email});
        if(!user){
            return res.status(404).json({message : "User not found"})
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if(!isPasswordValid){
            return res.status(400).json({message : "Invalid password"})
        }
        const token = genToken();
        user.token = token;
        await user.save();
        res.cookie("token", token, {
            maxAge : 1000 * 60 * 60 * 24 * 7,
            httpOnly : true,
            secure : process.env.NODE_ENV === "production",
        });
        return res.status(200).json({message : "User logged in successfully", user});
    }catch(err){
        console.error(err);
        return res.status(500).json({message : "Internal server error"})
    }
}
export {signup , login}