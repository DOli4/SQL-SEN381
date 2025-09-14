using System;

namespace CampusLearn.Models
{
    public abstract class User
    {
        public Guid UserId { get; protected set; }
        public string Username { get; protected set; }
        public string Email { get; protected set; }
        public string PasswordHash { get; protected set; } // hash in real app
        public string FirstName { get; protected set; }
        public string LastName { get; protected set; }
        public string Phone { get; protected set; }
        public DateTime? DateOfBirth { get; protected set; }
        public string Status { get; protected set; } = "Active";
        public DateTime CreatedOn { get; protected set; }
        public Role Role { get; set; }

        protected User(string username, string email, string firstName, string lastName)
        {
            UserId = Guid.NewGuid();
            Username = username;
            Email = email;
            FirstName = firstName;
            LastName = lastName;
            CreatedOn = DateTime.UtcNow;
        }

        public virtual void UpdateProfile(string firstName, string lastName, string phone = null)
        {
            FirstName = firstName;
            LastName = lastName;
            Phone = phone;
        }

        public void Deactivate() => Status = "Deactivated";
        public void Reactivate() => Status = "Active";

        // Dummy register/login placeholders (replace with real auth)
        public virtual void Register(string passwordHash)
        {
            PasswordHash = passwordHash;
            // additional registration logic...
        }

        public virtual bool Login(string passwordHash)
        {
            return PasswordHash == passwordHash;
        }

        public string DisplayName => $"{FirstName} {LastName}";
    }
}
