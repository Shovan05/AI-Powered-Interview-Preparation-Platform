import axios from "axios"


const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true
})

export async function register({ username, email, password }) {

    try {
        const response = await api.post('/api/auth/register', {
            username, email, password
        })

        return response.data

    } catch (err) {

        console.log(err)

    }

}

export async function login({ email, password }) {

    try {

        const response = await api.post("/api/auth/login", {
            email, password
        })

        return response.data

    } catch (err) {
        console.log(err)
    }

}

export async function logout() {
    try {

        const response = await api.get("/api/auth/logout")

        return response.data

    } catch (err) {
        console.log(err)
    }
}

export async function getMe() {

    try {

        const response = await api.get("/api/auth/get-me")

        return response.data

    } catch (err) {
        console.log(err)
    }

}

/**
 * @description Ask the server to email a password reset link.
 * No try/catch here on purpose: the page shows the server's error message.
 */
export async function forgotPassword(email) {
    const response = await api.post("/api/auth/forgot-password", { email })
    return response.data
}

/**
 * @description Set a new password using the token from the reset email.
 */
export async function resetPassword(token, newPassword) {
    const response = await api.post("/api/auth/reset-password", { token, newPassword })
    return response.data
}