using System;
using System.Collections.Generic;
using System.Linq;

namespace CampusLearn.Models
{
    public class Tutor : User
    {
        public List<Module> EnrolledModules { get; } = new List<Module>();
        public List<Topic> CreatedTopics { get; } = new List<Topic>();

        public Tutor(string username, string email, string firstName, string lastName)
            : base(username, email, firstName, lastName) { }

        public Topic CreateTopic(Module module, string title, string description)
        {
            if (!EnrolledModules.Contains(module))
                throw new InvalidOperationException("Tutor must be enrolled in the module to create topic.");

            var topic = module.CreateTopic(title, description, this);
            CreatedTopics.Add(topic);
            return topic;
        }

        public Reply AnswerTopic(Topic topic, string body)
        {
            if (!EnrolledModules.Contains(topic.Module))
                throw new InvalidOperationException("Tutor must be enrolled in the module to answer the topic.");

            var reply = topic.AddReply(this, body);
            return reply;
        }

        public Content UploadMaterial(Topic targetTopic, string pathOrUrl)
        {
            var content = new Content(pathOrUrl, topicId: targetTopic.TopicId);
            targetTopic.AttachContent(content);
            return content;
        }

        public void GiveFeedback(Reply reply, string feedback)
        {
            // simple behavior placeholder
            reply.AddInternalNote($"Feedback from {DisplayName}: {feedback}");
        }
    }
}
