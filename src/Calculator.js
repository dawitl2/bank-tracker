import { useState } from "react";

function Calculator(){

    const [display, setDisplay] = useState("");

    const press = (val) =>{
        setDisplay(display + val);
    };

    const clear = () =>{
        setDisplay("");
    };

    const calculate = () =>{
        try{
            // eslint-disable-next-line
            setDisplay(eval(display).toString());
        }catch{
            setDisplay("Error");
        }
    };

    return(
        <div style={styles.wrapper}>

            <h2>Calculator</h2>

            <input
                style={styles.display}
                value={display}
                readOnly
            />

            <div style={styles.grid}>
                {["7","8","9","/","4","5","6","*","1","2","3","-","0",".","%","+"].map(btn=>(
                    <button
                        key={btn}
                        style={styles.btn}
                        onClick={()=>press(btn)}
                    >
                        {btn}
                    </button>
                ))}
            </div>

            <button style={styles.equal} onClick={calculate}>
                =
            </button>

            <button style={styles.clear} onClick={clear}>
                Clear
            </button>

        </div>
    );
}

export default Calculator;



const styles = {

wrapper:{
    marginTop:"40px",
    padding:"20px",
    borderRadius:"16px",
    boxShadow:"0 4px 12px rgba(0,0,0,0.05)",
    background:"white"
},

display:{
    width:"100%",
    padding:"15px",
    fontSize:"22px",
    marginBottom:"10px",
    borderRadius:"10px",
    border:"1px solid #ddd"
},

grid:{
    display:"grid",
    gridTemplateColumns:"repeat(4,1fr)",
    gap:"10px"
},

btn:{
    padding:"15px",
    fontSize:"18px",
    borderRadius:"10px",
    border:"none",
    background:"#eee",
    cursor:"pointer"
},

equal:{
    width:"100%",
    padding:"15px",
    marginTop:"10px",
    borderRadius:"10px",
    border:"none",
    background:"#eeb833",
    color:"white",
    fontSize:"20px"
},

clear:{
    width:"100%",
    padding:"12px",
    marginTop:"8px",
    borderRadius:"10px",
    border:"none",
    background:"#ff4d4d",
    color:"white"
}

};
