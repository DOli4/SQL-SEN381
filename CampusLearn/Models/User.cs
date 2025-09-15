using System;

namespace CampusLearn.Models
{
    public enum UserStatus
    {
        Active,
        Inactive
    }

    public class User
    {
        // Attributes
        private int id;
        private string userName;
        private string firstName;
        private string lastName;
        private string phoneNumber;
        private string email;
        private string credentialInfo;
        private DateTime dateOfBirth;
        private string password;
        private UserStatus status;
        private DateTime createdOn;

        // Constructor
        public User(int id, string userName, string firstName, string lastName,
                    string phoneNumber, string email, string password, DateTime dateOfBirth)
        {
            this.id = id;
            this.userName = userName;
            this.firstName = firstName;
            this.lastName = lastName;
            this.phoneNumber = phoneNumber;
            this.email = email;
            this.password = password;
            this.dateOfBirth = dateOfBirth;
            this.status = UserStatus.Active;
            this.createdOn = DateTime.UtcNow;
        }

        
        public void Register()
        {
            credentialInfo = $"Registered on {DateTime.UtcNow}";
        }

        
        public bool Login(string password)
        {
            return this.password == password;
        }

        
        public void UpdateProfile(string firstName, string lastName, string phoneNumber)
        {
            this.firstName = firstName;
            this.lastName = lastName;
            this.phoneNumber = phoneNumber;
        }

        public void Deactivate()
        {
            status = UserStatus.Inactive;
        }

        
        public void Activate()
        {
            status = UserStatus.Active;
        }

        
        public void Upload(string filePath)
        {
            Console.WriteLine($"{userName} uploaded content: {filePath}");
        }

        
        public void CreateTopic(string title, string description)
        {
            Console.WriteLine($"{userName} created a topic: {title} - {description}");
        }
    }

    
    public class Student : User
    {
        public Student(int id, string userName, string firstName, string lastName,
                        string phoneNumber, string email, string password, DateTime dateOfBirth)
            : base(id, userName, firstName, lastName, phoneNumber, email, password, dateOfBirth) { }

        public void Subscribe() { }
        public void Unsubscribe() { }
        public void EnableNoti() { }
        public void DisableNoti() { }
    }

    public class Tutor : User
    {
        public Tutor(int id, string userName, string firstName, string lastName,
                        string phoneNumber, string email, string password, DateTime dateOfBirth)
            : base(id, userName, firstName, lastName, phoneNumber, email, password, dateOfBirth) { }

        public void AnswerTopic() { }
        public void UploadContent() { }
        public void Feedback() { }
    }

    public class Admin : User
    {
        public Admin(int id, string userName, string firstName, string lastName,
                        string phoneNumber, string email, string password, DateTime dateOfBirth)
            : base(id, userName, firstName, lastName, phoneNumber, email, password, dateOfBirth) { }

        public void Approve() { }
        public void Moderate() { }
        public void BanUser() { }
    }
}
