using System;
using System.Collections.Generic;


namespace CampusLearn.Models
{
    public class Module
    {
        // UML: private attributes
        private int id;
        private string name;
        private string description;
        private List<Topic> topics = new List<Topic>();
        private List<User> enrolledUsers = new List<User>();
        private DateTime startDate;
        private DateTime endDate;

        
        public Module(int id, string name, string description, DateTime startDate, DateTime endDate)
        {
            this.id = id;
            this.name = name;
            this.description = description;
            this.startDate = startDate;
            this.endDate = endDate;
        }

        
        public void enrol(User user)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            if (!enrolledUsers.Contains(user))
                enrolledUsers.Add(user);
        }


        public void unenrol(User user)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            enrolledUsers.Remove(user);
        }

        
        public Topic createTopic(User creator, string title, string description)
        {
            if (creator == null) throw new ArgumentNullException(nameof(creator));
            if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title required.", nameof(title));

            // Assumes a Topic constructor that links module, creator, title, description.
            var topic = new Topic(title, description, creator, this);
            topics.Add(topic);
            return topic;
        }

        
        public List<Topic> listTopics()
        {
            // Return a shallow copy to preserve encapsulation
            return new List<Topic>(topics);
        } 

        public void rename(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("Name cannot be empty.", nameof(newName));
            name = newName;
        }


        public void updateDes(string text)
        {
            description = text ?? string.Empty;
        }
    }
}
