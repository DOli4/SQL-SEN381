using System;

namespace CampusLearn.Models
{
    public class Content
    {
        public Guid ContentId { get; private set; }
        public string PathOrUrl { get; private set; }
        public Guid? TopicId { get; private set; }
        public Guid? ReplyId { get; private set; }
        public DateTime UploadedOn { get; private set; }

        public Content(string pathOrUrl, Guid? topicId = null, Guid? replyId = null)
        {
            if (topicId == null && replyId == null) throw new ArgumentException("Content must reference either a topic or a reply.");
            if (topicId != null && replyId != null) throw new ArgumentException("Content cannot reference both topic and reply (XOR).");

            ContentId = Guid.NewGuid();
            PathOrUrl = pathOrUrl;
            TopicId = topicId;
            ReplyId = replyId;
            UploadedOn = DateTime.UtcNow;
        }

        public void RelinkToTopic(Guid topicId)
        {
            ReplyId = null;
            TopicId = topicId;
        }

        public void RelinkToReply(Guid replyId)
        {
            TopicId = null;
            ReplyId = replyId;
        }
    }
}
