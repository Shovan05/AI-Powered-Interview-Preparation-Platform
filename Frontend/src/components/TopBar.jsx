import React from 'react'
import { useAuth } from '../features/auth/hooks/useAuth.js'
import './topbar.scss'

const TopBar = () => {
    const { user, handleLogout } = useAuth()

    return (
        <nav className='top-bar'>
            <span className='top-bar__brand'>AI Interview Prep</span>
            <div className='top-bar__actions'>
                {user && <span className='top-bar__user'>{user.username}</span>}
                <button className='logout-btn' onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    )
}

export default TopBar