import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 style={{ fontFamily: "'Dancing Script', cursive", background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>freindzX</h3>
            <p>Connect with people near you. Find your perfect match.</p>
          </div>

          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="/about">About</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Follow Us</h4>
            <div className="social-links">
              <a href="https://twitter.com" target="_blank" rel="noreferrer">
                Twitter
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer">
                Facebook
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Instagram
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} freindzX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};