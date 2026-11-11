import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import "../auth.form.scss"
import { resetPassword } from '../services/auth.api'

const ResetPassword = () => {
    const [ searchParams ] = useSearchParams()
    const token = searchParams.get("token")

    const [ newPassword, setNewPassword ] = useState("")
    const [ confirmPassword, setConfirmPassword ] = useState("")
    const [ loading, setLoading ] = useState(false)
    const [ message, setMessage ] = useState("")
    const [ error, setError ] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters")
            return
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        setLoading(true)
        try {
            const data = await resetPassword(token, newPassword)
            setMessage(data.message)
        } catch (err) {
            setError(err?.response?.data?.message || "Something went wrong. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (!token) {
        return (
            <main>
                <div className="form-container">
                    <h1>Reset password</h1>
                    <p>This reset link is missing its token. Please request a new link.</p>
                    <p><Link to={"/forgot-password"}>Request a new link</Link></p>
                </div>
            </main>
        )
    }

    if (message) {
        return (
            <main>
                <div className="form-container">
                    <h1>Password updated</h1>
                    <p>{message}</p>
                    <p><Link to={"/login"}>Go to login</Link></p>
                </div>
            </main>
        )
    }

    return (
        <main>
            <div className="form-container">
                <h1>Choose a new password</h1>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="newPassword">New password</label>
                        <input
                            onChange={(e) => { setNewPassword(e.target.value) }}
                            value={newPassword}
                            type="password" id="newPassword" name='newPassword' autoComplete="new-password" placeholder='At least 8 characters' />
                    </div>
                    <div className="input-group">
                        <label htmlFor="confirmPassword">Confirm password</label>
                        <input
                            onChange={(e) => { setConfirmPassword(e.target.value) }}
                            value={confirmPassword}
                            type="password" id="confirmPassword" name='confirmPassword' autoComplete="new-password" placeholder='Repeat the password' />
                    </div>
                    <button className='button primary-button' disabled={loading}>
                        {loading ? "Saving..." : "Reset password"}
                    </button>
                </form>
                {error && <p>{error}</p>}
            </div>
        </main>
    )
}

export default ResetPassword