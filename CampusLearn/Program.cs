using System;
using CampusLearn.Models;

namespace CampusLearn
{
    class Program
    {
        static void Main(string[] args)
        {
            // Users
            var tutor   = new Tutor("tutor1",   "tutor1@example.com",   "Tutor",   "One");
            var student = new Student("student1","student1@example.com","Student", "One");

            // Module (id, name, description, start, end)
            var module = new Module(
                id: 1,
                name: "CS101",
                description: "Intro to Programming",
                startDate: DateTime.Today,
                endDate: DateTime.Today.AddMonths(3));

            // Enrolments
            module.enrol(student);
            module.enrol(tutor);

            // Create a topic (creator, title, description)
            var topic = module.createTopic(
                creator: tutor,
                title: "How to loop in C#",
                description: "I need examples of for and foreach");

            // Replies
            var replyByStudent = topic.addReply(student, "You can use for and foreach. Example: ...");
            var replyByTutor   = topic.addReply(tutor,   "Good answer. See also LINQ.");

            // Content (use Tutor.upload or attach directly)
            var uploaded = tutor.upload(topic, "/files/loops.pdf"); // attaches to topic

            // Student subscribes to the topic (per UML)
            student.subscribe(topic);

            // Voting
            topic.upvote();
            replyByStudent.upvote();

            // Output (use getters from your classes)
            Console.WriteLine($"Module has {module.listTopics().Count} topic(s).");
            Console.WriteLine($"Topic '{topic.GetTitle()}' created by {topic.GetCreatedBy().UserName} with {topic.GetUpvotes()} upvote(s).");
            Console.WriteLine($"Reply by {replyByStudent.GetAuthor().UserName}: {replyByStudent.GetBody()}");

            Console.WriteLine("Demo complete.");
        }
    }
}
