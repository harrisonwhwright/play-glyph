import React from 'react';

// the sticky footer
const Footer = () => (
    <footer className="app-footer">
        <div className="footer-line">Thanks for playing!</div>
        <div className="footer-line footer-line-2">
            <span>© 2025 HarrisonWHWright</span>
            <a href="https://github.com/harrisonwhwright/play-glyph" target="_blank" rel="noopener noreferrer" className="footer-link">
                <img src="https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png" alt="GitHub" className="footer-logo" />
                play-glyph
            </a>
        </div>
    </footer>
);

export default Footer;