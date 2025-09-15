using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class Reply
    {
        // UML: private attributes
        private int id;
        private string body;
        private Topic topic;
        private Reply parentReplyId;               
        private User author;
        private string description;
        private int upvote;
        private int downvote;
        private DateTime createdOn;
        private DateTime edited;
        private readonly List<Reply> children = new List<Reply>();
        private readonly List<Content> attachments = new List<Content>();

        
        private static int nextId = 1;

        // Constructor 
        public Reply(int id, Topic topic, User author, string body, Reply parent = null, string description = "")
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (author == null) throw new ArgumentNullException(nameof(author));

            this.id = id;
            this.topic = topic;
            this.author = author;
            this.body = body ?? string.Empty;
            this.description = description ?? string.Empty;
            this.parentReplyId = parent;

            createdOn = DateTime.UtcNow;
            edited = createdOn;

            parent?.children.Add(this);
        }

        
        public static Reply Create(Topic topic, User author, string body, Reply parent = null, string description = "")
            => new Reply(nextId++, topic, author, body, parent, description);

        public void edit(string newBody)
        {
            if (string.IsNullOrWhiteSpace(newBody))
                throw new ArgumentException("Body cannot be empty.", nameof(newBody));

            body = newBody;
            edited = DateTime.UtcNow;
        }

        
        public Reply reply(User author, string body)
        {
            if (author == null) throw new ArgumentNullException(nameof(author));

            var child = new Reply(nextId++, topic, author, body ?? string.Empty, this);
            children.Add(child);
            return child;
        }

        
        public void attach(Content content)
        {
            if (content == null) throw new ArgumentNullException(nameof(content));
            attachments.Add(content);
        }

        
        public void upvote() => upvote++;

        public void downvote() => downvote++;

        
        public int GetId() => id;
        public string GetBody() => body;
        public Topic GetTopic() => topic;
        public Reply GetParent() => parentReplyId;
        public User GetAuthor() => author;
        public string GetDescription() => description;
        public int GetUpvotes() => upvote;
        public int GetDownvotes() => downvote;
        public DateTime GetCreatedOn() => createdOn;
        public DateTime GetEditedOn() => edited;
        public List<Reply> GetChildren() => new List<Reply>(children);
        public List<Content> GetAttachments() => new List<Content>(attachments);
    }
}
