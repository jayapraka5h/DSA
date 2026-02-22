// This file is used to check the AuthContext and Axios setup
// Ensure axios default headers persist
import axios from "axios";

const token = localStorage.getItem("token");
console.log("Token exists?", !!token);

if (token) {
  console.log("Testing creating a room directly...");
  axios
    .post(
      "http://localhost:5000/api/rooms",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    .then((res) => console.log("Success:", res.data))
    .catch((err) =>
      console.error("Failed:", err.response?.data || err.message),
    );
} else {
  console.log("No token found. User must login first.");
}
