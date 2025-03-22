import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "John", color: "teal" },
  { id: 2, name: "Ben", color: "red" },
];

async function UsedCodes() {
  const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1", [currentUserId]);
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}
async function GetColour() {
  const result = await db.query("SELECT color FROM users WHERE id = $1", [currentUserId]);
  return result.rows.length > 0 ? result.rows[0].color : "pink";

}



//GETS COUNTRY CODES
app.get("/", async (req, res) => {
  const countries = await UsedCodes();
  const color = await GetColour();
  const current_codes = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1", [currentUserId]);

  console.log(current_codes.rows.map(row => row.country_code));

  res.render("index.ejs", {
    countries: current_codes.rows.map(row => row.country_code),
    total: current_codes.rows.length,
    users: users,
    color: color,
  });
});

//ADDS COUNTRIES
app.post("/add", async (req, res) => {
  
  const country = req.body.country;
  let country_input;
  const usedcode = await UsedCodes();
  
  try {
    let country_input = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = $1",
      [country.toLowerCase()]
    );
  
    const colour = await GetColour();
  
    if (country_input.rows.length === 0) {
      country_input = await db.query(
        "SELECT country_code FROM countries WHERE country_name ILIKE '%' || $1 || '%'",
        [country.toLowerCase()]
      );
  
      if (country_input.rows.length === 0) {
        console.log(usedcode); // Debugging Log (Ensure 'usedcode' is always defined!)
        
        res.render("index.ejs", {
          countries: usedcode || [],  // Ensure 'usedcode' is always defined
          total: usedcode?.length || 0,
          users: users,
          color: colour,
          error: "Country Not Found! Try Again",
        });
  
        console.error("Country Not Found! Try Again");
        return;  // Ensure function stops execution here
      }
    }
  
    const new_code = country_input.rows[0]?.country_code;
  
    if (!usedcode.includes(new_code)) {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [new_code, currentUserId]
      );
    } else {
      console.log("Country already exists");
      return res.redirect("/");  // Ensure function stops here
    }
  
    return res.redirect("/");  // Ensure function stops after redirect
  
  } catch (error) {
    console.error("Error:", error);
    return res.redirect("/");
  }
});  

//SELECTING A USER
app.post("/user", async (req, res) => {
  const user_id = req.body["user"];
  console.log(user_id);
  if (req.body.add === "new") {
    res.render("new.ejs");
    return;}
  else
  {
  currentUserId = user_id;
  res.redirect("/");
}
});

//ADDING A NEW USER
app.post("/new", async (req, res) => {
  console.log("Received form submission:", req.body); // Debugging log

  const name = req.body.name;
  const color = req.body.color;

  if (!name || !color) {
    console.error("Missing name or color!");
    return res.status(400).send("Name and color are required.");
  }

  console.log("Name:", name); // Debugging log
  console.log("Color:", color); // Debugging log

  try {
    // Get the maximum id from the users table
    const maxIdResult = await db.query("SELECT MAX(id) AS max_id FROM users");
    const maxId = maxIdResult.rows[0].max_id || 0; // If no users exist, start from 0
    const newId = maxId + 1; // Increment the max id by 1

    console.log("Generated new ID:", newId); // Debugging log

    // Insert the new user with the generated id
    const result = await db.query(
      "INSERT INTO users (id, name, color) VALUES($1, $2, $3) RETURNING *;",
      [newId, name, color]
    );

    console.log("User added:", result.rows[0]); // Debugging log

    // Update the currentUserId and the users array
    currentUserId = newId;
    users.push({ id: newId, name: name, color: color });

    console.log("Updated users array:", users); // Debugging log

    res.redirect("/");
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
