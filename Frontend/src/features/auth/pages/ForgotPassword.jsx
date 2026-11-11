import React, { useState } from 'react'
import { Link } from 'react-router'
import "../auth.form.scss"
import { forgotPassword } from '../services/auth.api'

const ForgotPassword = () => {
    const [ email, setEmail ] = useState("")
    const [ loading, setLoading ] = useState(false)
    const [ message, setMessage ] = useState("")
    const [ error, setError ] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")
        setLoading(true)

        try {
            const data = await forgotPassword(email)
            setMessage(data.message)
        } catch (err) {
            setError(err?.response?.data?.message || "Something went wrong. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main>
            <div className="form-container">
                <h1>Forgot password</h1>
                <p>Enter your email and we'll send you a link to choose a new password.</p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            onChange={(e) => { setEmail(e.target.value) }}
                            value={email}
                            type="email" id="email" name='email' placeholder='Enter email address' required />
                    </div>
                    <button className='button primary-button' disabled={loading}>
                        {loading ? "Sending..." : "Send reset link"}
                    </button>
                </form>
                {message && <p>{message}</p>}
                {error && <p>{error}</p>}
                <p><Link to={"/login"}>Back to login</Link></p>
            </div>
        </main>
    )
}

export default ForgotPassword