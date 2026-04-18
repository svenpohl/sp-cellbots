

//
// Bot class mini
//
class bot_class_mini 
{


constructor() 
  {
  
  this.id       = "";
  this.bottmpid = "";
  this.rid      = "";
  this.type     = 0;
  this.x        = 0;
  this.y        = 0;
  this.z        = 0;
  this.vector_x = 0;
  this.vector_y = 0;
  this.vector_z = 0;  
  
  this.color = "000000";
  
  this.checked = 0;
  
  this.checked_neighbors = [];  
  this.checked_neighbors['f'] = -1;
  this.checked_neighbors['r'] = -1;
  this.checked_neighbors['b'] = -1;
  this.checked_neighbors['l'] = -1;
  this.checked_neighbors['t'] = -1;
  this.checked_neighbors['d'] = -1;
  
  this.adress = "";


  this.nbh_info = [];
  this.nbh_info['f'] = "";
  this.nbh_info['r'] = "";
  this.nbh_info['b'] = "";
  this.nbh_info['l'] = "";
  this.nbh_info['t'] = "";
  this.nbh_info['d'] = "";
  
 
  } // constructor()
  
  
  

setvalues( id, rid = "", x,y,z, vx,vy,vz, color, adress)
{
this.id       = id;
this.rid      = Array.isArray(rid) ? String(rid[0] ?? "") : String(rid ?? "");

this.x        = x;
this.y        = y;
this.z        = z;

this.vector_x = vx;
this.vector_y = vy;
this.vector_z = vz;

this.color    = color;
this.adress   = adress;
} // setvalues()

  
  
  
} // class bot_class_mini


module.exports = bot_class_mini;  
