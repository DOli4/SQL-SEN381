using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class Reply
    {
        public Guid ReplyId { get; private set; }
        public Topic Topic { get; private set; }
        public User Author { get; private set; }
        public Reply Parent { get; private set; }
        public string Body { get; private set; }
        public int Upvotes { get; private set; }
        public int Downvotes { get; private set; }
        public DateTime CreatedOn { get; private set; }

        private readonly List<Reply> _children = new List<Reply>();
        private readonly List<string> _internalNotes = new List<string>();

        public IReadOnlyList<Reply> Children => _children.AsReadOnly();

        public Reply(Topic topic, User author, string body, Reply parent = null)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (author == null) throw new ArgumentNullException(nameof(author));

            ReplyId = Guid.NewGuid();
            Topic = topic;
            Author = author;
            Body = body;
            Parent = parent;
            CreatedOn = DateTime.UtcNow;

            parent?._children.Add(this);
        }

        public void Edit(string newBody)
        {
            Body = newBody;
        }

        public Reply ReplyTo(string body)
        {
            var child = new Reply(this.Topic, this.Author, body, this);
            _children.Add(child);
            return child;
        }

        public void Upvote() => Upvotes++;
        public void Downvote() => Downvotes++;

        internal void AddInternalNote(string note)
        {
            _internalNotes.Add(note);
        }
    }
}
