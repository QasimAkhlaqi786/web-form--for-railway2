const express=require('express');
const router=express.Router();
const members=require('../Members')
const uuid=require('uuid');


router.get('/members',(req,res)=>{
    res.json(members)
})
router.get('/members/:id',(req,res)=>{
    const found=members.some(member=>member.id===parseInt(req.params.id));
    if(found)
        res.json(members.filter(member=>member.id===parseInt(req.params.id)));
    else
        res.status(400).json({msg:'member not found'});
});
router.post('/members',(req,res)=>{
    const newMember={
        
        id: uuid.v4(),
        name: req.body.name,
        email: req.body.email,
        status: 'Active',

    }
    if(!newMember.email || !newMember.name)
        return res.status(400).json({msg:'name / email must not empty:'})

    members.push(newMember);
    res.json(members);
});

//Update Members

router.get('/members',(req,res)=>{
    res.json(members)
})
router.get('/members/:id',(req,res)=>{
    const found=members.some(member=>member.id===parseInt(req.params.id));
    if(found)
        res.json(members.filter(member=>member.id===parseInt(req.params.id)));
    else
        res.status(400).json({msg:'member not found'});
});

// Delete Members
router.delete('/members/:id',(req,res)=>{
    const found=members.some(member=>member.id===parseInt(req.params.id));
    if(found)
        
        res.json({ 
            msg :'member deleted',
            members:members.filter(member=>member.id!==parseInt(req.params.id))
            })
        
    else
        res.status(400).json({msg:'member not found'})
});

module.exports=router;