using Microsoft.AspNetCore.Mvc;

namespace JCIReliefWeb.Controllers
{
    public class CommunityController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Cộng đồng";
            return View();
        }
    }
}
