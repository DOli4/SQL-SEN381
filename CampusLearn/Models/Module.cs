using System;
using System.Collections.Generic;
using System.Linq;

namespace CampusLearn.Models
{
    public class Module
    {
        public Guid ModuleId { get; private set; }
        public string Code { get; private set; } // e.g. CS101
        public string Name { get; private set; }
        public string Description { get; private set; }
        public List<User> EnrolledUsers { get; } = new List<User>();
        public List<Topic> Topics { get; } = new List<Topic>();

        public Module(string code, string name, string description = null)
        {
            ModuleId = Guid.NewGuid();
            Code = code;
            Name = name;
            Description = description;
        }

        public bool EnrolUser(User user)
        {
            if (user == null) return false;
            if (!EnrolledUsers.Contains(user))
            {
                EnrolledUsers.Add(user);
                if (user is Student s && !s.EnrolledModules.Contains(this)) s.EnrolledModules.Add(this);
                if (user is Tutor t && !t.EnrolledModules.Contains(this)) t.EnrolledModules.Add(this);
                return true;
            }
            return false;
        }

        public bool RemoveUser(User user)
        {
            if (user == null) return false;
            if (EnrolledUsers.Contains(user))
            {
                EnrolledUsers.Remove(user);
                if (user is Student s && s.EnrolledModules.Contains(this)) s.EnrolledModules.Remove(this);
                if (user is Tutor t && t.EnrolledModules.Contains(this)) t.EnrolledModules.Remove(this);
                return true;
            }
            return false;
        }

        public Topic CreateTopic(string title, string description, User creator)
        {
            var topic = new Topic(title, description, creator, this);
            Topics.Add(topic);
            return topic;
        }

        public void RemoveTopic(Topic topic)
        {
            if (Topics.Contains(topic)) Topics.Remove(topic);
        }

        public List<Topic> ListTopics() => Topics.ToList();
    }
}