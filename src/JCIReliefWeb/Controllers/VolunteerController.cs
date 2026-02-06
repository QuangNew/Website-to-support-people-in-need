using Microsoft.AspNetCore.Mvc;

namespace JCIReliefWeb.Controllers
{
    public class VolunteerController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Đăng ký tình nguyện";
            return View();
        }

        public IActionResult Dashboard()
        {
            ViewData["Title"] = "Bảng điều khiển TNV";
            return View();
        }
    }
}
