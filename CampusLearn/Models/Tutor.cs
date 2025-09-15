using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class Tutor : User
    {
        public List<Module> EnrolledModules { get; } = new List<Module>();
        public List<Topic> CreatedTopics { get; } = new List<Topic>(); 

        
        private static int _nextContentId = 1;

        public Tutor(string username, string email, string firstName, string lastName)
            : base(username, email, firstName, lastName) { }

        
        public Reply answerTopic(Topic topic, string body)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (!EnrolledModules.Contains(topic.GetModule()))
                throw new InvalidOperationException("Tutor must be enrolled in the module to answer the topic.");

            return topic.addReply(this, body);
        }

        
        public Content upload(Topic topic, string filePath)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (string.IsNullOrWhiteSpace(filePath)) throw new ArgumentException("File path required.", nameof(filePath));
            if (!EnrolledModules.Contains(topic.GetModule()))
                throw new InvalidOperationException("Tutor must be enrolled in the module to upload to this topic.");

            var content = new Content(_nextContentId++, filePath);
            topic.attach(content);
            return content;
        }

        
        public Reply feedback(Reply parentReply, string body)
        {
            if (parentReply == null) throw new ArgumentNullException(nameof(parentReply));
            var topic = parentReply.GetTopic();
            if (!EnrolledModules.Contains(topic.GetModule()))
                throw new InvalidOperationException("Tutor must be enrolled in the module to give feedback.");

            // feedback is modeled as a child reply to the given reply
            return parentReply.reply(this, body);
        }
    }
}
