using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class Topic
    {
        private static int _nextId = 1;

        // UML: private attributes
        private int id;
        private User user;
        private Module module;
        private string title;
        private User createdBy;
        private string description;
        private readonly List<User> subscribers = new List<User>();
        private readonly List<Content> attachments = new List<Content>();
        private readonly List<Reply> replies = new List<Reply>();
        private int upvotes;
        private int downvotes;

        
        private bool closed;

        // Constructor 
        public Topic(string title, string description, User creator, Module module)
        {
            if (creator == null) throw new ArgumentNullException(nameof(creator));
            if (module == null) throw new ArgumentNullException(nameof(module));
            if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));

            id = _nextId++;
            this.title = title;
            this.description = description ?? string.Empty;
            createdBy = creator;
            user = creator; 
            this.module = module;
        }

        
        public void edit(string title, string description, string content)
        {
            if (closed) throw new InvalidOperationException("Topic is closed.");
            if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));

            this.title = title;
            this.description = description ?? string.Empty;
            
        }

        
        public Reply addReply(User author, string body)
        {
            if (closed) throw new InvalidOperationException("Topic is closed.");
            if (author == null) throw new ArgumentNullException(nameof(author));

            var reply = Reply.Create(this, author, body, null, "");
            replies.Add(reply);
            return reply;
        }

        
        public void attach(Content content)
        {
            if (content == null) throw new ArgumentNullException(nameof(content));
            attachments.Add(content);
        }

        
        public void upvote() => upvotes++;

        
        public void downvote() => downvotes++;

        
        public void close() => closed = true;

        
        internal void AddSubscriber(User subscriber)
        {
            if (subscriber == null) throw new ArgumentNullException(nameof(subscriber));
            if (!subscribers.Contains(subscriber)) subscribers.Add(subscriber);
        }

        internal void RemoveSubscriber(User subscriber)
        {
            if (subscriber == null) throw new ArgumentNullException(nameof(subscriber));
            subscribers.Remove(subscriber);
        }

        
        public int GetId() => id;
        public User GetUser() => user;
        public Module GetModule() => module;
        public string GetTitle() => title;
        public User GetCreatedBy() => createdBy;
        public string GetDescription() => description;
        public IReadOnlyList<User> GetSubscribers() => subscribers.AsReadOnly();
        public IReadOnlyList<Content> GetAttachments() => attachments.AsReadOnly();
        public IReadOnlyList<Reply> GetReplies() => replies.AsReadOnly();
        public int GetUpvotes() => upvotes;
        public int GetDownvotes() => downvotes;
        public bool IsClosed() => closed;
    }
}
