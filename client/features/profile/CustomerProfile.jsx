import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventContext';
import { User, Phone, MapPin, CheckCircle, Save } from 'lucide-react';

export default function CustomerProfile() {
  const { user, updateProfile } = useAuth();
  const { addLocalEvent } = useEvents();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    zip: user?.address?.zip || ''
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await updateProfile({
        name: formData.name,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip
        }
      });

      // Emit UserProfileUpdated Event
      addLocalEvent('UserProfileUpdated', 'user-service', {
        userId: user?.id,
        phone: user?.phone,
        updatedFields: ['name', 'address']
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      alert(err.message || 'Profile update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div>
            <h2>Customer Profile</h2>
            <p className="profile-subtitle">Phone: {user?.phone} • Role: {user?.role}</p>
          </div>
        </div>

        {isSaved && (
          <div className="auth-alert success mb-4">
            <CheckCircle size={16} />
            <span>Profile successfully updated! <code>UserProfileUpdated</code> emitted.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-with-icon">
              <User size={16} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Phone Number (Primary Login ID)</label>
            <div className="input-with-icon">
              <Phone size={16} />
              <input type="tel" value={user?.phone || formData.phone} disabled className="input-disabled" />
            </div>
          </div>

          <h4 className="section-title mt-4">Shipping Destination</h4>

          <div className="form-group">
            <label>Street Address</label>
            <div className="input-with-icon">
              <MapPin size={16} />
              <input
                type="text"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="form-group flex-1">
              <label>State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div className="form-group flex-1">
              <label>Zip Code</label>
              <input
                type="text"
                value={formData.zip}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" className="btn-save-profile" disabled={isUpdating}>
            <Save size={16} />
            {isUpdating ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
